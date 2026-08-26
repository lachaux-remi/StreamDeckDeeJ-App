#include <napi.h>

#include <audiopolicy.h>
#include <endpointvolume.h>
#include <mmdeviceapi.h>
#include <windows.h>
#include <wrl/client.h>

#include <cmath>
#include <cstdint>
#include <iomanip>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>

using Microsoft::WRL::ComPtr;

namespace {

std::string Utf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(),
                                      static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) return {};
  std::string result(size, '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
                      result.data(), size, nullptr, nullptr);
  return result;
}

std::string SystemMessage(HRESULT result) {
  wchar_t* buffer = nullptr;
  const DWORD size = FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM |
                                        FORMAT_MESSAGE_IGNORE_INSERTS,
                                    nullptr, static_cast<DWORD>(result), 0,
                                    reinterpret_cast<wchar_t*>(&buffer), 0, nullptr);
  std::wstring message = size && buffer ? std::wstring(buffer, size) : L"unknown Windows error";
  if (buffer) LocalFree(buffer);
  while (!message.empty() && (message.back() == L'\r' || message.back() == L'\n')) {
    message.pop_back();
  }
  return Utf8(message);
}

void Check(HRESULT result, const char* operation) {
  if (SUCCEEDED(result)) return;
  std::ostringstream error;
  error << operation << " failed (HRESULT 0x" << std::hex << std::uppercase
        << static_cast<uint32_t>(result) << "): " << SystemMessage(result);
  throw std::runtime_error(error.str());
}

class ComApartment {
 public:
  ComApartment() : result_(CoInitializeEx(nullptr, COINIT_MULTITHREADED)) {
    if (result_ != RPC_E_CHANGED_MODE) Check(result_, "CoInitializeEx");
  }

  ~ComApartment() {
    if (SUCCEEDED(result_)) CoUninitialize();
  }

 private:
  HRESULT result_;
};

class CoreAudio {
 public:
  CoreAudio() {
    Check(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                           IID_PPV_ARGS(enumerator_.GetAddressOf())),
          "CoCreateInstance(MMDeviceEnumerator)");
    Check(enumerator_->GetDefaultAudioEndpoint(eRender, eMultimedia, device_.GetAddressOf()),
          "GetDefaultAudioEndpoint(eRender, eMultimedia)");
  }

  ComPtr<IAudioEndpointVolume> EndpointVolume() const {
    ComPtr<IAudioEndpointVolume> volume;
    Check(device_->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_ALL, nullptr,
                            reinterpret_cast<void**>(volume.GetAddressOf())),
          "IMMDevice::Activate(IAudioEndpointVolume)");
    return volume;
  }

  ComPtr<IAudioSessionEnumerator> Sessions() const {
    ComPtr<IAudioSessionManager2> manager;
    Check(device_->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr,
                            reinterpret_cast<void**>(manager.GetAddressOf())),
          "IMMDevice::Activate(IAudioSessionManager2)");
    ComPtr<IAudioSessionEnumerator> sessions;
    Check(manager->GetSessionEnumerator(sessions.GetAddressOf()),
          "IAudioSessionManager2::GetSessionEnumerator");
    return sessions;
  }

 private:
  ComPtr<IMMDeviceEnumerator> enumerator_;
  ComPtr<IMMDevice> device_;
};

std::wstring ProcessName(DWORD process_id) {
  HANDLE raw = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
  if (!raw) return {};
  struct HandleCloser {
    void operator()(void* handle) const { CloseHandle(handle); }
  };
  std::unique_ptr<void, HandleCloser> process(raw);

  std::wstring path(32768, L'\0');
  DWORD size = static_cast<DWORD>(path.size());
  if (!QueryFullProcessImageNameW(raw, 0, path.data(), &size)) return {};
  path.resize(size);
  const size_t separator = path.find_last_of(L"\\/");
  return separator == std::wstring::npos ? path : path.substr(separator + 1);
}

struct Target {
  bool master;
  DWORD process_id;
};

Target ParseTarget(const Napi::Value& value) {
  if (!value.IsObject()) throw std::invalid_argument("target must be an object");
  Napi::Object target = value.As<Napi::Object>();
  Napi::Value kind_value = target.Get("kind");
  if (!kind_value.IsString()) throw std::invalid_argument("target kind must be master or process");
  const std::string kind = kind_value.As<Napi::String>().Utf8Value();
  if (kind == "master") return {true, 0};
  if (kind != "process") throw std::invalid_argument("target kind must be master or process");
  Napi::Value process_id = target.Get("processId");
  if (!process_id.IsNumber()) throw std::invalid_argument("processId must be a positive integer");
  const double number = process_id.As<Napi::Number>().DoubleValue();
  if (!std::isfinite(number) || number < 1 || number > UINT32_MAX || std::floor(number) != number) {
    throw std::invalid_argument("processId must be a positive integer");
  }
  return {false, static_cast<DWORD>(number)};
}

template <typename Operation>
void ForProcessSessions(const CoreAudio& audio, DWORD process_id, Operation operation) {
  ComPtr<IAudioSessionEnumerator> sessions = audio.Sessions();
  int count = 0;
  Check(sessions->GetCount(&count), "IAudioSessionEnumerator::GetCount");
  for (int index = 0; index < count; ++index) {
    ComPtr<IAudioSessionControl> control;
    Check(sessions->GetSession(index, control.GetAddressOf()),
          "IAudioSessionEnumerator::GetSession");
    ComPtr<IAudioSessionControl2> control2;
    Check(control.As(&control2),
          "IAudioSessionControl::QueryInterface(IAudioSessionControl2)");
    DWORD candidate = 0;
    Check(control2->GetProcessId(&candidate), "IAudioSessionControl2::GetProcessId");
    if (candidate != process_id) continue;
    ComPtr<ISimpleAudioVolume> volume;
    Check(control.As(&volume),
          "IAudioSessionControl::QueryInterface(ISimpleAudioVolume)");
    operation(volume.Get());
  }
}

Napi::Value Snapshot(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    ComApartment apartment;
    CoreAudio audio;
    Napi::Object result = Napi::Object::New(env);

    ComPtr<IAudioEndpointVolume> endpoint = audio.EndpointVolume();
    float master_volume = 0;
    BOOL master_muted = FALSE;
    Check(endpoint->GetMasterVolumeLevelScalar(&master_volume),
          "IAudioEndpointVolume::GetMasterVolumeLevelScalar");
    Check(endpoint->GetMute(&master_muted), "IAudioEndpointVolume::GetMute");
    Napi::Object master = Napi::Object::New(env);
    master.Set("volume", master_volume);
    master.Set("muted", master_muted != FALSE);
    result.Set("master", master);

    ComPtr<IAudioSessionEnumerator> sessions = audio.Sessions();
    int count = 0;
    Check(sessions->GetCount(&count), "IAudioSessionEnumerator::GetCount");
    Napi::Array values = Napi::Array::New(env);
    uint32_t output_index = 0;
    for (int index = 0; index < count; ++index) {
      ComPtr<IAudioSessionControl> control;
      Check(sessions->GetSession(index, control.GetAddressOf()),
            "IAudioSessionEnumerator::GetSession");
      ComPtr<IAudioSessionControl2> control2;
      Check(control.As(&control2),
            "IAudioSessionControl::QueryInterface(IAudioSessionControl2)");
      DWORD process_id = 0;
      Check(control2->GetProcessId(&process_id), "IAudioSessionControl2::GetProcessId");
      if (process_id == 0) continue;

      ComPtr<ISimpleAudioVolume> volume;
      Check(control.As(&volume),
            "IAudioSessionControl::QueryInterface(ISimpleAudioVolume)");
      float scalar = 0;
      BOOL muted = FALSE;
      Check(volume->GetMasterVolume(&scalar), "ISimpleAudioVolume::GetMasterVolume");
      Check(volume->GetMute(&muted), "ISimpleAudioVolume::GetMute");

      Napi::Object session = Napi::Object::New(env);
      session.Set("processId", Napi::Number::New(env, process_id));
      session.Set("name", Napi::String::New(env, Utf8(ProcessName(process_id))));
      session.Set("volume", scalar);
      session.Set("muted", muted != FALSE);
      values.Set(output_index++, session);
    }
    result.Set("sessions", values);
    return result;
  } catch (const std::exception& error) {
    Napi::Error::New(env, error.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value SetVolume(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    if (info.Length() != 2 || !info[1].IsNumber()) {
      throw std::invalid_argument("setVolume requires target and scalar");
    }
    const Target target = ParseTarget(info[0]);
    const double scalar = info[1].As<Napi::Number>().DoubleValue();
    if (!std::isfinite(scalar) || scalar < 0 || scalar > 1) {
      throw std::out_of_range("volume must be a finite number from 0 to 1");
    }
    ComApartment apartment;
    CoreAudio audio;
    if (target.master) {
      Check(audio.EndpointVolume()->SetMasterVolumeLevelScalar(static_cast<float>(scalar), nullptr),
            "IAudioEndpointVolume::SetMasterVolumeLevelScalar");
    } else {
      ForProcessSessions(audio, target.process_id, [&](ISimpleAudioVolume* volume) {
        Check(volume->SetMasterVolume(static_cast<float>(scalar), nullptr),
              "ISimpleAudioVolume::SetMasterVolume");
      });
    }
    return env.Undefined();
  } catch (const std::exception& error) {
    Napi::Error::New(env, error.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Value SetMuted(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  try {
    if (info.Length() != 2 || !info[1].IsBoolean()) {
      throw std::invalid_argument("setMuted requires target and boolean");
    }
    const Target target = ParseTarget(info[0]);
    const BOOL muted = info[1].As<Napi::Boolean>().Value() ? TRUE : FALSE;
    ComApartment apartment;
    CoreAudio audio;
    if (target.master) {
      Check(audio.EndpointVolume()->SetMute(muted, nullptr), "IAudioEndpointVolume::SetMute");
    } else {
      ForProcessSessions(audio, target.process_id, [&](ISimpleAudioVolume* volume) {
        Check(volume->SetMute(muted, nullptr), "ISimpleAudioVolume::SetMute");
      });
    }
    return env.Undefined();
  } catch (const std::exception& error) {
    Napi::Error::New(env, error.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
}

Napi::Object Initialize(Napi::Env env, Napi::Object exports) {
  exports.Set("snapshot", Napi::Function::New(env, Snapshot));
  exports.Set("setVolume", Napi::Function::New(env, SetVolume));
  exports.Set("setMuted", Napi::Function::New(env, SetMuted));
  return exports;
}

}  // namespace

NODE_API_MODULE(windows_audio, Initialize)
