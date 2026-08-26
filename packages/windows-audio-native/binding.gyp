{
  "targets": [
    {
      "target_name": "windows_audio",
      "sources": [],
      "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
      "defines": ["NAPI_CPP_EXCEPTIONS", "NAPI_VERSION=10", "UNICODE", "_UNICODE"],
      "conditions": [
        [
          "OS=='win' and target_arch=='x64'",
          {
            "sources": ["native/windows_audio.cc"],
            "libraries": ["-lole32"],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "AdditionalOptions": ["/std:c++20", "/EHsc", "/W4"]
              }
            }
          },
          {
            "sources": []
          }
        ]
      ]
    }
  ]
}
