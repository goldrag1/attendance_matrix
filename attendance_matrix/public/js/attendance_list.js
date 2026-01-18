frappe.listview_settings['Attendance'] = {
    onload: function (listview) {
        listview.page.add_inner_button(__("Chấm công nhanh"), function () {
            frappe.set_route('attendance-matrix');
        });
    }
};
