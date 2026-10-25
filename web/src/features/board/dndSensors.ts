import {
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * All drag sensor configuration lives here. Touch needs a long press (250 ms,
 * under 5 px of movement) so an ordinary swipe always scrolls the page.
 */
export function useBoardSensors() {
	return useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 5 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
			// Enter stays "open the card"; only Space picks up and drops.
			keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
		}),
	);
}
