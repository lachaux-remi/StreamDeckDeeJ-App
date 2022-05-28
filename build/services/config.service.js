"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = exports.CONFIG_PATH = void 0;
const tslib_1 = require("tslib");
const electron_log_1 = tslib_1.__importDefault(require("electron-log"));
const fs_1 = tslib_1.__importStar(require("fs"));
const yaml_1 = require("yaml");
exports.CONFIG_PATH = "./config.yaml";
class ConfigService {
    constructor() {
        /**
         * Debounce for config file changes
         * @private
         */
        this.debounce = null;
        /**
         * Save the config to the config file
         * @param data new config data
         */
        this.saveConfig = (data) => {
            try {
                (0, fs_1.writeFileSync)(exports.CONFIG_PATH, (0, yaml_1.stringify)(data));
            }
            catch {
                electron_log_1.default.error(`CONFIG | Error writing ${exports.CONFIG_PATH}`);
            }
        };
        /**
         * Read the config file
         * @private
         */
        this.readYAML = () => {
            try {
                const buff = (0, fs_1.readFileSync)(exports.CONFIG_PATH, "utf-8");
                return (0, yaml_1.parse)(buff);
            }
            catch (error) {
                return undefined;
            }
        };
        /**
         * Reads the config file and parses it into a config object
         * @private
         */
        this.readConfig = () => {
            electron_log_1.default.debug(`CONFIG | Load config file`);
            const config = this.readYAML();
            if (!config) {
                electron_log_1.default.verbose(`CONFIG | ${exports.CONFIG_PATH} not found`);
                electron_log_1.default.error(`CONFIG | Cannot work without config`);
                return process.exit();
            }
            this.config = config;
        };
        electron_log_1.default.info(`INIT | ConfigService`);
        if (!fs_1.default.existsSync(exports.CONFIG_PATH)) {
            this.saveConfig({
                slider_mapping: {
                    0: ["master"],
                    1: ["brave.exe", "chrome.exe"],
                    2: ["wwahost.exe", "spotify.exe", "disneyplus.exe"],
                    3: ["steam.exe"],
                    4: ["discord.exe"]
                },
                invert_sliders: false,
                com_port: "COM3",
                baud_rate: 115200
            });
        }
        // watch config file for changes and reload
        (0, fs_1.watch)(exports.CONFIG_PATH, { encoding: "utf8" }, () => {
            if (this.debounce !== null)
                return;
            // create a debounce to prevent multiple reads
            this.debounce = setTimeout(() => {
                electron_log_1.default.info(`CONFIG | Config file changed`);
                this.readConfig();
                // clear debounce
                clearTimeout(this.debounce);
                this.debounce = null;
            }, 500);
        });
        this.readConfig();
    }
}
exports.ConfigService = ConfigService;
//# sourceMappingURL=config.service.js.map