import { registerRootComponent } from "expo";
import { registerWidgetConfigurationScreen } from "react-native-android-widget";
import { Platform } from "react-native";
import React from "react";

import App from "./App";
// Importing for side effect: defines the background alert task at module scope
// so it exists in headless contexts too.
import "./src/tasks/alertTask";
import { WidgetConfigScreen } from "./src/widgets/WidgetConfigScreen";
import { registerWidgetSyncTask } from "./src/widgets/widgetSync";

if (Platform.OS === "android") {
  registerWidgetConfigurationScreen((props) => React.createElement(WidgetConfigScreen, props));
  // Headless fetch task the native ⟳ button worker runs (app may be closed).
  registerWidgetSyncTask();
}

registerRootComponent(App);
