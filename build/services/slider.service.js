"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SliderService = void 0;
const tslib_1 = require("tslib");
const electron_log_1 = tslib_1.__importDefault(require("electron-log"));
const node_events_1 = tslib_1.__importDefault(require("node:events"));
const EXPECTED_LINE_PATTERN = RegExp(/^\d{1,4}(\|\d{1,4})*$/);
class SliderService extends node_events_1.default {
    constructor(configService, serialService) {
        super();
        this.configService = configService;
        /**
         * Slide save value for check significant changes
         */
        this.state = {};
        /**
         * Debounce for config file changes
         * @private
         */
        this.debounce = null;
        /**
         * Event handler for slider change events
         * @param data
         */
        this.sliderChangeEvent = (data) => {
            if (this.debounce !== null)
                return;
            // create a debounce to prevent multiple
            this.debounce = setTimeout(() => {
                if (!EXPECTED_LINE_PATTERN.test(data))
                    return;
                data.split("|")
                    .map(str => parseInt(str, 10) / 2 ** 10)
                    .map(val => val > 1 ? 1 : val < 0 ? 0 : val)
                    .map(val => (this.configService.config.invert_sliders ? 1 - val : val))
                    .map(val => {
                    const p = Math.pow(10, 3);
                    return Math.round(val * p * (1 + Number.EPSILON)) / p;
                })
                    .forEach((val, key) => {
                    const pre = this.state[key] ?? undefined;
                    const curr = val;
                    if (pre === undefined || Math.abs(pre - curr) >= 0.009) {
                        electron_log_1.default.debug(`SESSIONS | Slider ${key} change detected: ${val}`);
                        this.state[key] = curr;
                        this.emit("sliderChange", key, curr);
                    }
                });
                // clear debounce
                clearTimeout(this.debounce);
                this.debounce = null;
            }, 10);
        };
        electron_log_1.default.info("INIT | SliderService");
        serialService.on("serialData", this.sliderChangeEvent);
    }
}
exports.SliderService = SliderService;
//# sourceMappingURL=slider.service.js.map