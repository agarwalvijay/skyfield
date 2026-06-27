package com.atsumilabs.skyfield.widget;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;
import androidx.work.WorkerParameters;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import com.reactnativeandroidwidget.oss.HeadlessJsTaskWorker;

/**
 * Runs the "SkyfieldWidgetSync" headless JS task (widgetData/widgetSync.ts) so
 * the ⟳ button can fetch fresh data even while the app is closed. The JS task
 * writes the store; when it finishes we broadcast APPWIDGET_UPDATE so the native
 * provider re-reads and repaints. Reuses the library's generic headless worker
 * base (WorkManager + HeadlessJsTaskService plumbing).
 */
public class WidgetSyncWorker extends HeadlessJsTaskWorker {
    private static final String TASK_NAME = "SkyfieldWidgetSync";

    public WidgetSyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    /** Enqueue a one-shot, expedited sync for one widget. */
    public static void enqueue(Context context, int widgetId, boolean force) {
        Data data = new Data.Builder()
            .putIntArray("widgetIds", new int[]{widgetId})
            .putBoolean("force", force)
            .build();

        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(WidgetSyncWorker.class)
            .setInputData(data)
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build();

        WorkManager.getInstance(context).enqueueUniqueWork(
            "skyfield-widget-sync-" + widgetId,
            ExistingWorkPolicy.REPLACE,
            req);
    }

    @Nullable
    @Override
    protected HeadlessJsTaskConfig getTaskConfig(Data data) {
        WritableMap args = Arguments.createMap();
        WritableArray ids = Arguments.createArray();
        int[] widgetIds = data.getIntArray("widgetIds");
        if (widgetIds != null) {
            for (int id : widgetIds) ids.pushInt(id);
        }
        args.putArray("widgetIds", ids);
        args.putBoolean("force", data.getBoolean("force", true));

        // name, args, timeout(ms), allowedInForeground
        return new HeadlessJsTaskConfig(TASK_NAME, args, 30 * 1000, true);
    }

    @Override
    public void onHeadlessJsTaskFinish(int taskId) {
        // The JS task has written the store — poke every widget shape to repaint.
        BaseSkyfieldWidget.updateAll(getApplicationContext());
        super.onHeadlessJsTaskFinish(taskId);
    }
}
