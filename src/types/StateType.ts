import { store } from "@/stores/store";

export type RootState = ReturnType<typeof store.getState>;
