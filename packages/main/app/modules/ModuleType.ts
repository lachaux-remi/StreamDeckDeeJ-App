export default interface ModuleType {
    key: "macro" | "ir" | "tapo" | "octopi-led"
    name: string
    inputs: ModuleInputs[]
}

export type ModuleInputs = { name: string }
    & ( { type: "text" | "textarea" } | { type: "select", values: ModuleInputValues[] } )

export type ModuleInputValues = {
    key: string
    name: string
}
