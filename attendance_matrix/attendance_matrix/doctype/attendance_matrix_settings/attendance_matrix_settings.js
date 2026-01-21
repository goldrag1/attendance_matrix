// Copyright (c) 2026, Antigravity and contributors
// For license information, please see license.txt

frappe.ui.form.on('Attendance Matrix Settings', {
    refresh: function (frm) {
        // Show Current Version
        frappe.call({
            method: "attendance_matrix.attendance_matrix.utils.updates.check_for_updates",
            callback: function (r) {
                if (r.message) {
                    let msg = `Current Version: <b>${r.message.local_version}</b>`;
                    if (r.message.update_available) {
                        msg += ` &bull; <span style="color:red">Update Available: <b>${r.message.remote_version}</b></span>`;
                        frm.dashboard.set_headline_alert(msg, "red");

                        // Add Prominent Update Button
                        frm.add_custom_button(__("Update to {0}", [r.message.remote_version]), function () {
                            frappe.confirm(__("Are you sure you want to update to {0}?", [r.message.remote_version]), function () {
                                frappe.call({
                                    method: "attendance_matrix.attendance_matrix.utils.updates.perform_update",
                                    freeze: true,
                                    freeze_message: __("Updating..."),
                                    callback: function (r) {
                                        if (r.message.status === "success") frappe.msgprint(r.message.message);
                                    }
                                });
                            });
                        }).addClass("btn-danger");

                    } else {
                        msg += ` &bull; <span style="color:green">Maintained</span>`;
                        frm.dashboard.set_headline_alert(msg, "green");
                    }
                }
            }
        });

        frm.add_custom_button(__('Check for Updates'), function () {
            frappe.call({
                method: "attendance_matrix.attendance_matrix.utils.updates.check_for_updates",
                freeze: true,
                callback: function (r) {
                    if (r.message && r.message.update_available) {
                        frappe.confirm(
                            __('Version {0} is available. Do you want to update now?', [r.message.remote_version]),
                            function () {
                                frappe.call({
                                    method: "attendance_matrix.attendance_matrix.utils.updates.perform_update",
                                    freeze: true,
                                    callback: function (r) {
                                        if (r.message.status === "success") {
                                            frappe.msgprint(r.message.message);
                                        }
                                    }
                                });
                            }
                        );
                    } else if (r.message && !r.message.update_available) {
                        frappe.msgprint(__('You are on the latest version.'));
                    }
                }
            });
        });
    }
});
