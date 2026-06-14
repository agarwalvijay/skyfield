import { registerRootComponent } from "expo";
import {
  registerWidgetConfigurationScreen,
  registerWidgetTaskHandler,
} from "react-native-android-widget";
import { Platform } from "react-native";
import React from "react";

import App from "./App";
// Importing for side effect: defines the background alert task at module scope
// so it exists in headless contexts too.
import "./src/tasks/alertTask";
import { widgetTaskHandler } from "./src/widgets/widgetTaskHandler";
import { WidgetConfigScreen } from "./src/widgets/WidgetConfigScreen";

if (Platform.OS === "android") {
  registerWidgetTaskHandler(widgetTaskHandler);
  registerWidgetConfigurationScreen((props) => React.createElement(WidgetConfigScreen, props));
}

registerRootComponent(App);
