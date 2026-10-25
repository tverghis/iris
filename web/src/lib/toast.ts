// sonner (~12 kB gzipped) is loaded on demand: the Toaster mounts lazily and
// toasts wait until it is subscribed, since sonner does not replay missed ones.
let markReady: () => void = () => {};
const ready = new Promise<void>((resolve) => {
	markReady = resolve;
});

export const toasterMounted = () => markReady();

export async function toastError(message: string) {
	const [{ toast }] = await Promise.all([import("sonner"), ready]);
	toast.error(message, { id: message });
}
