import ConfigType from "./ConfigType"

const ConfigDefault: ConfigType = {
    com_port: "COM3",
    baud_rate: 115200,
    invert_sliders: true,
    slider_mapping: {
        0: [ "master" ],
        1: [ "chrome.exe" ],
        2: [ "spotify.exe" ],
        3: [ "steam.exe" ],
        4: [ "discord.exe" ]
    },
    deck_mapping: {
        "0": {
            image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI0AAACNCAMAAAHKhzkBAAAACXBIWXMAAC4jAAAuIwF4pT92AAAMTmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDIwLTExLTA0VDE1OjUyOjQ2KzAxOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIyLTA2LTA0VDIwOjEyOjI1KzAyOjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMi0wNi0wNFQyMDoxMjoyNSswMjowMCIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ZGU3ZDZkODgtZjE4ZS1kYTRjLWEwYzktY2RhZDkyMGExZGY4IiB4bXBNTTpEb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6ZDA2MTViMDItNDRlOS0wMzQ0LWE5ZmMtODZhMWRiYzJlN2E2IiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6YzRmNjkzNTctNWQxOC0zYTRkLWE2NjEtZGIzM2FiYTFhMTNhIiB0aWZmOk9yaWVudGF0aW9uPSIxIiB0aWZmOlhSZXNvbHV0aW9uPSIzMDAwMDAwLzEwMDAwIiB0aWZmOllSZXNvbHV0aW9uPSIzMDAwMDAwLzEwMDAwIiB0aWZmOlJlc29sdXRpb25Vbml0PSIyIiBleGlmOkNvbG9yU3BhY2U9IjY1NTM1IiBleGlmOlBpeGVsWERpbWVuc2lvbj0iMTQxIiBleGlmOlBpeGVsWURpbWVuc2lvbj0iMTQxIj4gPHBob3Rvc2hvcDpEb2N1bWVudEFuY2VzdG9ycz4gPHJkZjpCYWc+IDxyZGY6bGk+MWY1OTQwNTItY2JhMy1mYjRlLTFkNjQtZDU5YjAwMDAwMDQ1PC9yZGY6bGk+IDxyZGY6bGk+MjIyMTVkMDUtODkyNi1jY2U2LWFlM2EtN2NlNzAwMDAwMDQ5PC9yZGY6bGk+IDxyZGY6bGk+NTkxZDFkYTUtOGI5NC05ZjJkLTJhZGUtMmIxYjAwMDAwMDNmPC9yZGY6bGk+IDxyZGY6bGk+YWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjBiNDRjZGI5LTYyMWItMGQ0Yy1iMzg2LTQ1NDIxYWZkNzgwZjwvcmRmOmxpPiA8cmRmOmxpPmFkb2JlOmRvY2lkOnBob3Rvc2hvcDo4ZjY0MzE0MS0wMDQzLTJiNGItOTA3MS1mYmVjNWYxODBlYzk8L3JkZjpsaT4gPHJkZjpsaT54bXAuZGlkOmRlMzY2MzM1LWM5NWQtNjg0YS05MjhlLWQ3OWZiOGJmN2UyODwvcmRmOmxpPiA8L3JkZjpCYWc+IDwvcGhvdG9zaG9wOkRvY3VtZW50QW5jZXN0b3JzPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmM0ZjY5MzU3LTVkMTgtM2E0ZC1hNjYxLWRiMzNhYmExYTEzYSIgc3RFdnQ6d2hlbj0iMjAyMC0xMS0wNFQxNTo1Mjo0NiswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDplNmZjNzYxNC0xOWI3LWI1NDItYTVmMy0wMTZhOWY4YWYyZmUiIHN0RXZ0OndoZW49IjIwMjItMDUtMTdUMTU6NDk6NTQrMDI6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE5IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6ZjUyMjQ1OTMtNzBhNC02MDQ3LWJmNTgtZTdlYzFmZjdjZjRjIiBzdEV2dDp3aGVuPSIyMDIyLTA2LTA0VDIwOjEyOjI1KzAyOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNvbnZlcnRlZCIgc3RFdnQ6cGFyYW1ldGVycz0iZnJvbSBhcHBsaWNhdGlvbi92bmQuYWRvYmUucGhvdG9zaG9wIHRvIGltYWdlL3BuZyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iZGVyaXZlZCIgc3RFdnQ6cGFyYW1ldGVycz0iY29udmVydGVkIGZyb20gYXBwbGljYXRpb24vdm5kLmFkb2JlLnBob3Rvc2hvcCB0byBpbWFnZS9wbmciLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmRlN2Q2ZDg4LWYxOGUtZGE0Yy1hMGM5LWNkYWQ5MjBhMWRmOCIgc3RFdnQ6d2hlbj0iMjAyMi0wNi0wNFQyMDoxMjoyNSswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpmNTIyNDU5My03MGE0LTYwNDctYmY1OC1lN2VjMWZmN2NmNGMiIHN0UmVmOmRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDowYjQ0Y2RiOS02MjFiLTBkNGMtYjM4Ni00NTQyMWFmZDc4MGYiIHN0UmVmOm9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpjNGY2OTM1Ny01ZDE4LTNhNGQtYTY2MS1kYjMzYWJhMWExM2EiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz51a4j+AAACeVBMVEX///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8avHfUAAAA0nRSTlMAAwQFBgcICgwNDg8QERITFBUWFxgZGhwdHh8gISMkJicpKissLS8xMjM0NTY4OTo7PD0+P0BBQkNERUZHSElKS05PUFJTVFVWV1haW1xeX2BhYmNkZWZnaGlqa2xub3BxcnN0dXZ3eHl6e3x9fn+BgoOEhYaHiImKi4yNj5GSk5SVlpeYmZqbnJ2eoKGio6Slp6ipqqusra6vsLGys7W4ury9v8DDxMXGx8jJy8zNzs/R0tPU1trb3+Di4+Xm5+jp6uvt7/Dx9PX29/j5+vv8/f4X7JHDAAAFQ0lEQVQYGe3BjX9VdQHA4S8KKBUWJvZqZGClUYi9mCSWmE7LlMAXoEgkrSgUyrEtsdgcmiKi5EtREAxxgPYGaZpCRSmoLMHvX9S559xt99yX3Xv243L2+XCfh1GYQSWvopzTGaakGSHFyHFJUUFSFB5TyihlpJyUMQJIBQ9Rro3mmkkZpdxHZJiuIMUCSn3PAlK6VCSlQ0App5SRcpJm5CDMknJKhesYW2648ytSj7qLqs57liKJfJNKAxZQ0ySHUFu7CVBq6zTST8QItXR6JgW3GmFkSj3KSB7u7+/Xvv6zaJgR6lLqcxmnMqlnAZupS6UelXr+7BVUtXE1Q2Q+VRhhZBbcRE3/sehuanEYtTgIpRYTME6pxRgRpRYLiIwzQnXqMQqMUIMSM8LIetQtjKjXh6ljneuoo9sHqKPX9YxkT3//X327fy+1zbCImEo9KvWo1KPfpp7JbdQnLaeKW64DtgASyshRwizuwdjBa3oJs9uCiQSS2K3folF/s2AFlZ6kcW84iNH52F7TNpDdu61EdgNWRWadpg0ARsisy1IUnG6EzNY4jMRpJvaQSZdFZzNoson9ZNJhAcOes4iM7vjXGZS4z8SNhOhRuxb3PTKJEN3qekL1qg8Rap16H6F61HsZtR9YjlKPv7KQcMYOEMoEoa63gHDvmzbtAk6Ay1RaWlrGnA8T2UxkOiEElgFfbCeIfGbzKma2E+hFI1MINMMYQXp//IQx1i8lRLsxQllwmEDnn6++OpEwl7QTk4YtfOb3l5L22TXAU0SkMTONUWkpjfuSRYSY7aCtjN4XHMaoLHvdNEZhvhXI7hkrHCSzP1nFMrKyqiVkZIVZO9Tbycgyl8Lv1OVkZMotRPrUJWRkqXso2KEuJyNLrCa2VV1ORg6bS6JPfUG9kgwcwqCdJtrJwKK3GXLExHvIwMQHGGLRI2RhwW8YZtGzZKI+TwmLvkM2Lz9KqeMmCGLR6YQwMuXRHQsIYoRgRghmhGBGCGaEYEYIZoRgRhi1jz/fX7DLyPb+/j2/ZFQsN5cSV/59+1k0wnLvYtg7RlYRqMcYgUzcQxgTawjzmDFCWfAQoaYYIdwF06ZNJVxbW9unCafuItwHlZaWlpaWljFk0UZyd7HXkth0jMSFLiI3C7yGEhf5c3J1/ZwJm4ztOO/c+eTtSYe8RN5+Yomt5GfjgQM7edoS/2b1wQNPkJ+LLXETeZt41EEzydlFLoFrt7z8j77FZzDbNnJ0oV3E5q0itsivc4JN/OFLxv63eSYj+dQNFD0uRd+Yx4k015T7ydElA5abTk5mv2Gldz7KSfWhqxavav/ZzYsGrGotJ8s5a9+0ngc5OTbaiCs4CSb/0Ya8eRvNt8nGLaHZ/msDXt9tYilN1mU9A3OAbSbuoMk6HcnhL5P4g4mlNFmHtS1g0PidJm6jyTqtpYMS20zcSZN1Wd0SUrabuHnc51c8+MDtn6NZOqziramkTegz7ac0SZcVvk+FcduOmXI5TdJpWi9VtFnmRpqlwxLfpZrdltlF83RZtPs0qnraMr+mmbqMPDeBGia9Zcor59BcE99LTfeb9hT56TZxxNg/l5GfHhPryV+PiQ3kr9vEOvLXbaKX/PWY2ED+uk2sI3/dJn5B/npM/Ir8dRs7vpYcnHvIOvaM56RZZV1XU90n/2LstYWcMJftPTyi7Z+gqjOPOuyr5Ow1S32NfJlyL/k6Yql55Ov9lria3P3WolcZC7YbOzSesWDa/v379u174UeMCVPvumvlypV3X86YcPY+C+YwRsza/eJSWlpaTkX/B/lC5r+H26XGAAAAAElFTkSuQmCC",
            pressed: {
                module: "macro",
                params: [
                    "240"
                ]
            },
            hold: {
                module: "macro",
                params: [
                    "240"
                ]
            }
        }
    }
}
export default ConfigDefault
