import fetch from "electron-fetch"

export type DeviceInfo = {
    lights_on: boolean
    torch_on: boolean
}

export default class OctopiLedModule {
    private ipAddress: string | undefined

    public connect = (ip: string): OctopiLedModule => {
        this.ipAddress = ip
        return this
    }

    public toggleLight = async (): Promise<DeviceInfo> => {
        return this.sendPayloadToDevice( {
            "command": "lights_toggle"
        } )
    }

    public turnLightOn = (): Promise<DeviceInfo> => {
        return this.sendPayloadToDevice( {
            "command": "lights_on"
        } )
    }

    public turnLightOff = (): Promise<DeviceInfo> => {
        return this.sendPayloadToDevice( {
            "command": "lights_off"
        } )
    }

    public toggleTorche = async (): Promise<DeviceInfo> => {
        const info = await this.getDeviceInfo()
        switch ( info.torch_on ) {
            case true:
                return this.turnTorcheOff()
            case false:
                return this.turnTorcheOn()
        }
    }

    public turnTorcheOn = (): Promise<DeviceInfo> => {
        return this.sendPayloadToDevice( {
            "command": "torch_on"
        } )
    }

    public turnTorcheOff = (): Promise<DeviceInfo> => {
        return this.sendPayloadToDevice( {
            "command": "torch_off"
        } )
    }

    private getDeviceInfo = (): Promise<DeviceInfo> => {
        return this.sendPayloadToDevice( {
            "command": "test_os_config"
        } )
    }

    private sendPayloadToDevice = async (payload: object): Promise<DeviceInfo> => {
        const response = await fetch( `http://${ this.ipAddress }/api/plugin/ws281x_led_status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify( payload )
        } )
        return await response.json()
    }
}
