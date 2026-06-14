import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Current on-screen keyboard height (0 when hidden).
 *
 * Exists because React Native `Modal`s render in their own window that does
 * NOT honor the activity's `adjustResize`, so the keyboard overlaps modal
 * content. Any bottom sheet with a TextInput should lift itself by this value.
 * Designed in as a primitive so we never re-solve this per sheet.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
