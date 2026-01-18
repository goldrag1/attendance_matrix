// Copyright (c) 2026, Antigravity and contributors
// For license information, please see license.txt

frappe.ui.form.on('Attendance Matrix Settings', {
    refresh: function (frm) {
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
