import { writable } from "svelte/store";
import { get } from "svelte/store";

// Incremented each time the user requests opening the create-transaction modal.
// Consumers compare against their last-seen value so mount does not auto-open.
export const createTransactionRequest = writable(0);
export { get };
