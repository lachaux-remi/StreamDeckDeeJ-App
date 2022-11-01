import * as crypto from "crypto"
import { Buffer } from "buffer"
import { pad } from "../helpers"
import { v4 as uuid } from "uuid"
import fetch from "electron-fetch"
import { session } from "electron"

export type DeviceInfo = {
    device_id: string
    type: string
    model: string
    mac: string
    device_on: boolean
    on_time: number
    overheated: boolean
    nickname: string
    brightness: number
    ip: string
    ssid: string
    signal_level: number
    [key: string]: any
}

export const ERROR_CODES = {
    "0": "Success",
    "-1010": "Invalid Public Key Length",
    "-1012": "Invalid terminalUUID",
    "-1501": "Invalid Request or Credentials",
    "1002": "Incorrect Request",
    "-1003": "JSON formatting error "
}

export default class TapoModule {
    private readonly terminalUUID: any
    private ipAddress: string | undefined
    private encodedPassword: string | null = null
    private encodedEmail: string | null = null
    private keys: { privateKey: string; publicKey: string } | undefined
    private cookie: string | null = null

    private key: Buffer | null = null
    private iv: Buffer | null = null
    private token: string | null = null

    constructor() {
        this.terminalUUID = uuid()
    }

    public connect = (ip: string, email: string, password: string): Promise<TapoModule> => {
        const encodedPassword = Buffer.from( password ).toString( "base64" )
        const bufferEmail = crypto.createHash( "sha1" ).update( email ).digest()

        let sb = ""
        for ( let i = 0; i < bufferEmail.length; i++ ) {
            const hex = ( bufferEmail[i] & 255 ).toString( 16 )
            if ( hex.length == 1 ) {
                sb += "0"
                sb += hex
            } else {
                sb += hex
            }
        }

        const encodedEmail = Buffer.from( sb ).toString( "base64" )

        return this.connectWithHash( ip, encodedEmail, encodedPassword )
    }

    public connectWithHash = async (ip: string, email: string, password: string): Promise<TapoModule> => {
        this.ipAddress = ip
        this.encodedEmail = email
        this.encodedPassword = password

        const { publicKey, privateKey } = await new Promise( (resolve) => {
            crypto.generateKeyPair( "rsa", {
                modulusLength: 1024,
                publicKeyEncoding: { type: "spki", format: "pem" },
                privateKeyEncoding: { type: "pkcs1", format: "pem" }
            }, (_, publicKey, privateKey) => {
                resolve( { publicKey, privateKey } )
            } )
        } )
        this.keys = { publicKey, privateKey }

        await this.handshake()
        await this.login()

        return this
    }

    public brightness = async (): Promise<DeviceInfo> => {
        const info = await this.getDeviceInfo()
        await this.sendPayloadToDevice( {
            "method": "set_device_info",
            "params": {
                "brightness": info.brightness === 100 ? 10 : info.brightness + 10
            },
            "requestTimeMils": Date.now(),
            "terminalUUID": this.terminalUUID
        } )
        return this.getDeviceInfo()
    }

    public toggle = async (): Promise<DeviceInfo> => {
        const info = await this.getDeviceInfo()
        await this.sendPayloadToDevice( {
            "method": "set_device_info",
            "params": {
                "device_on": !info.device_on
            },
            "requestTimeMils": Date.now(),
            "terminalUUID": this.terminalUUID
        } )
        return this.getDeviceInfo()
    }

    public turnOn = async (): Promise<DeviceInfo> => {
        await this.sendPayloadToDevice( {
            "method": "set_device_info",
            "params": {
                "device_on": true,
                "brightness": 10
            },
            "requestTimeMils": Date.now(),
            "terminalUUID": this.terminalUUID
        } )
        return this.getDeviceInfo()
    }

    public turnOff = async (): Promise<DeviceInfo> => {
        this.sendPayloadToDevice( {
            "method": "set_device_info",
            "params": {
                "device_on": false
            },
            "requestTimeMils": Date.now(),
            "terminalUUID": this.terminalUUID
        } )
        return this.getDeviceInfo()
    }

    private getDeviceInfo = (): Promise<DeviceInfo> => {
        return this.sendPayloadToDevice( {
            "method": "get_device_info",
            "requestTimeMils": Date.now(),
            "terminalUUID": this.terminalUUID
        } )
    }

    private handshake = async (): Promise<void> => {
        await session.defaultSession.clearStorageData()

        const response = await fetch( `http://${ this.ipAddress }/app`, {
            method: "POST",
            useSessionCookies: true,
            body: JSON.stringify( {
                "method": "handshake",
                "params": {
                    "key": this.keys?.publicKey,
                    "requestTimeMils": Date.now()
                }
            } )
        } )

        const json = await response.json()
        const encryptedKey = json["result"]["key"]
        this.decodeHandshakeKey( encryptedKey )
        this.cookie = response.headers.get( "Set-Cookie" )
        this.cookie = this.cookie?.substring( 0, this.cookie.length - 13 ) || null
    }

    private login = async (): Promise<void> => {
        const response = await fetch( `http://${ this.ipAddress }/app`, {
            method: "POST",
            useSessionCookies: true,
            body: JSON.stringify( {
                method: "securePassthrough",
                params: {
                    request: this.encryptPayload( JSON.stringify( {
                        method: "login_device",
                        params: { username: this.encodedEmail, password: this.encodedPassword },
                        requestTimeMils: Date.now()
                    } ) )
                }
            } )
        } )

        const json = await response.json()
        const decrypted = this.decryptPayload( Buffer.from( json["result"]["response"], "base64" ) )
        const decryptedJson = JSON.parse( decrypted.toString() )

        if ( decryptedJson["error_code"] != 0 ) {
            // @ts-ignore
            throw new Error( ERROR_CODES[decryptedJson["error_code"]] )
        }
        this.token = decryptedJson["result"]["token"]
    }

    private sendPayloadToDevice = async (payload: object): Promise<any> => {
        const response = await fetch( `http://${ this.ipAddress }/app?token=${ this.token }`,
            {
                method: "POST",
                useSessionCookies: true,
                body: JSON.stringify( {
                    method: "securePassthrough",
                    params: {
                        request: this.encryptPayload( JSON.stringify( payload ) )
                    }
                } )
            } )

        const json = await response.json()
        return JSON.parse( this.decryptPayload( Buffer.from( json["result"]["response"], "base64" ) ).toString() )["result"]
    }

    private decodeHandshakeKey = (key: string): void => {
        const decrypted = crypto.privateDecrypt(
            {
                key: this.keys?.privateKey!,
                padding: crypto.constants.RSA_PKCS1_PADDING
            },
            Buffer.from( key, "base64" )
        )

        this.key = decrypted.subarray( 0, 16 )
        this.iv = decrypted.subarray( 16, 32 )
    }

    // @ts-ignore
    private mime_encoder = (to_encode): string => {
        const encoded_list = Array.from( Buffer.from( to_encode ).toString( "base64" ) )
        let count = 0
        for ( let index = 76; index < encoded_list.length - 1; index = index + 76 ) {
            encoded_list.splice( index + count, 0, "\r\n" )
            count += 1
        }
        return encoded_list.join( "" )
    }

    private decryptPayload = (payload: Buffer): Buffer => {
        // @ts-ignore
        const decipher = crypto.createDecipheriv( "AES-128-CBC", this.key, this.iv )
        return Buffer.concat( [ decipher.update( payload ), decipher.final() ] )
    }

    private encryptPayload = (payload: string): string => {
        return this.mime_encoder(
            // @ts-ignore
            crypto.createCipheriv( "AES-128-CBC", this.key, this.iv ).update(
                Buffer.from( pad( Buffer.from( payload ) ) )
            ) )
    }
}
