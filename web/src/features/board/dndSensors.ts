import {
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/** All drag sensor configuration lives here (touch long-press goes here too). */
export function useBoardSensors() {
	return useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
			// Enter stays "open the card"; only Space picks up and drops.
			keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
		}),
	);
}
