frappe.listview_settings['Attendance'] = {
    onload: function (listview) {
        listview.page.add_inner_button(__("Quick Attendance"), function () {
            frappe.set_route('attendance-matrix');
        });
    }
};
