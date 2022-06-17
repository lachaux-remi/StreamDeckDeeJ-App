export default interface ConfigType {
    com_port: string
    baud_rate: number
    invert_sliders: boolean
    tapo_account?: TapoConfig
    slider_mapping: SliderMapping
    deck_mapping: DeckMapping
}

export type TapoConfig = {
    username: string
    password: string
}

export type SliderMapping = {
    [configKey: string]: string[]
}

export type DeckMapping = {
    [configKey: string]: DeckConfig
}

export type DeckConfig = {
    image?: string
    pressed: DeckStateConfig
    hold?: DeckStateConfig
}

export type DeckState = Exclude<keyof DeckConfig, "image">

export type DeckStateConfig = {
    module: string
    params: string[]
}

