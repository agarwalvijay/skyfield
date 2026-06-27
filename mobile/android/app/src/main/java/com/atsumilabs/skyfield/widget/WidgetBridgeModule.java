package com.atsumilabs.skyfield.widget;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Lets JS repaint the native banner widget the instant it writes fresh data to
 * the store — instead of waiting on Android's unreliable ~30-min
 * updatePeriodMillis. Called after every store write (app-open publish and
 * background sync) so the widget is always as fresh as the data we hold.
 */
public class WidgetBridgeModule extends ReactContextBaseJavaModule {
    public WidgetBridgeModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "WidgetBridge";
    }

    /** Repaint every widget shape from the store now. */
    @ReactMethod
    public void requestUpdate() {
        BaseSkyfieldWidget.updateAll(getReactApplicationContext());
    }
}
