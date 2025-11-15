/**
 * Dynamic Date Updater for Hospital Bill Templates
 * This script automatically sets the discharge date to today's date
 * across all template files
 */

(function () {
    'use strict';

    // Embedded date configuration (from date.json)
    // This is embedded to avoid CORS issues when opening files directly
    let dateConfig = {
        "template-1.html": { "day": 3, "style": 1 },
        "template-2.html": { "day": 4, "style": 2 },
        "template-3.html": { "day": 4, "style": 1 },
        "template-4.html": { "day": 5, "style": 2 },
        "template-5.html": { "day": 3, "style": 1 },
        "template-6.html": { "day": 4, "style": 2 },
        "template-7.html": { "day": 3, "style": 1 },
        "template-8.html": { "day": 2, "style": 2 },
        "template-9.html": { "day": 5, "style": 2 },
        "template-10.html": { "day": 3, "style": 1 },
        "template-11.html": { "day": 2, "style": 1 },
        "template-12.html": { "day": 4, "style": 2 },
        "template-13.html": { "day": 4, "style": 1 },
        "template-14.html": { "day": 2, "style": 2 },
        "template-15.html": { "day": 5, "style": 1 }
    };

    /**
     * Generate random time (hours and minutes)
     * Returns an object with hours and minutes
     */
    function generateRandomTime() {
        const hours = Math.floor(Math.random() * 24);
        const minutes = Math.floor(Math.random() * 60);
        return { hours, minutes };
    }

    /**
     * Format date as "8th November, 2025 12:00 PM" (Style 1)
     */
    function formatDateStyle1(date) {
        const day = date.getDate();
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        // Add suffix (st, nd, rd, th)
        let suffix = 'th';
        if (day === 1 || day === 21 || day === 31) suffix = 'st';
        else if (day === 2 || day === 22) suffix = 'nd';
        else if (day === 3 || day === 23) suffix = 'rd';

        // Format time
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        const hoursStr = String(hours).padStart(2, '0');

        return `${day}${suffix} ${month}, ${year} ${hoursStr}:${minutes} ${ampm}`;
    }

    /**
     * Format date as "15-Nov-2025, 03:00 PM" (Style 2)
     */
    function formatDateStyle2(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        const hoursStr = String(hours).padStart(2, '0');

        return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${ampm}`;
    }

    /**
     * Format date as "DD-MM-YYYY" (Style 3)
     */
    function formatDateStyle3(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    }

    /**
     * Get current template name from URL
     */
    function getTemplateName() {
        return window.location.pathname?.split("/")?.pop();
    }

    /**
     * Get configuration for current template
     */
    function getTemplateConfig() {
        const templateName = getTemplateName();

        if (!templateName) {
            console.error('Could not determine template name from URL');
            return null;
        }

        const config = dateConfig[templateName];

        if (config) {
            console.log(`Using config for ${templateName}:`, config);
            return config;
        }

        // Default config if not found
        console.warn(`No config found for ${templateName}, using defaults`);
        return { day: 7, style: 2 };
    }

    /**
     * Update discharge date by element ID
     */
    function updateDischargeDateById(elementId, date, formatStyle) {
        const element = document.getElementById(elementId);
        if (element) {
            let formattedDate;
            switch (formatStyle) {
                case 1:
                    formattedDate = formatDateStyle1(date);
                    break;
                case 2:
                    formattedDate = formatDateStyle2(date);
                    break;
                case 3:
                    formattedDate = formatDateStyle3(date);
                    break;
                default:
                    formattedDate = formatDateStyle2(date);
            }

            element.textContent = formattedDate;
            console.log(`Updated ${elementId} to: ${formattedDate}`);
        }
    }

    /**
     * Update dates by searching for text patterns (fallback)
     */
    function updateDatesByText(dischargeDate, admissionDate, formatStyle) {
        let formattedDischargeDate, formattedAdmissionDate;

        if (formatStyle === 1) {
            formattedDischargeDate = formatDateStyle1(dischargeDate);
            formattedAdmissionDate = formatDateStyle1(admissionDate);
        } else {
            formattedDischargeDate = formatDateStyle2(dischargeDate);
            formattedAdmissionDate = formatDateStyle2(admissionDate);
        }

        // Find all elements that might contain dates
        const allElements = document.querySelectorAll('.info-value, .card-info, .cell-value, .detail-value, .box-value, .item-value, .card-data, .entry-value, .info-content, .field-data, .info-data, .field-content');

        allElements.forEach(element => {
            const parentLabel = element.parentElement?.querySelector('.info-label, .card-title, .cell-label, .detail-label, .box-label, .item-label, .card-label, .entry-label, .info-title, .field-title, .field-name');

            if (parentLabel) {
                const labelText = parentLabel.textContent.toLowerCase();

                // Update discharge date
                if (labelText.includes('discharge date') || labelText.includes('date of discharge')) {
                    element.textContent = formattedDischargeDate;
                    console.log('Updated discharge date (by text search):', formattedDischargeDate);
                }

                // Update admission date
                if (labelText.includes('admission date') || labelText.includes('date of admission')) {
                    element.textContent = formattedAdmissionDate;
                    console.log('Updated admission date (by text search):', formattedAdmissionDate);
                }
            }
        });
    }

    /**
     * Update all dates in the template
     */
    function updateDates() {
        // First, get template name from window.location
        const templateName = getTemplateName();

        if (!templateName) {
            console.error('Cannot update dates: Template name not found in URL');
            return;
        }

        console.log(`Template identified: ${templateName}`);

        // Get configuration for this template
        const config = getTemplateConfig();

        if (!config) {
            console.error('Cannot update dates: No configuration available');
            return;
        }

        const { day, style } = config;

        console.log(`Configuration loaded - Days: ${day}, Style: ${style}`);
        console.log('Processing admission and discharge dates...');

        // Create discharge date (today) with random time
        const dischargeDate = new Date();
        const dischargeTime = generateRandomTime();
        dischargeDate.setHours(dischargeTime.hours, dischargeTime.minutes, 0, 0);

        // Create admission date (today - day) with random time
        const admissionDate = new Date();
        admissionDate.setDate(admissionDate.getDate() - day);
        const admissionTime = generateRandomTime();
        admissionDate.setHours(admissionTime.hours, admissionTime.minutes, 0, 0);

        // Format the dates for logging
        const formattedDischargeDate = style === 1 ? formatDateStyle1(dischargeDate) : formatDateStyle2(dischargeDate);
        const formattedAdmissionDate = style === 1 ? formatDateStyle1(admissionDate) : formatDateStyle2(admissionDate);

        // Log the dates
        console.log('=== Date Configuration ===');
        console.log(`Template: ${templateName}`);
        console.log(`Style: ${style}`);
        console.log(`Days between admission and discharge: ${day}`);
        console.log('');
        console.log(`Admission Date: ${formattedAdmissionDate}`);
        console.log(`Discharge Date: ${formattedDischargeDate}`);
        console.log('=========================');

        // Update discharge date elements
        updateDischargeDateById('discharge-date', dischargeDate, style);
        updateDischargeDateById('discharge-date-value', dischargeDate, style);

        // Update admission date elements
        updateDischargeDateById('admission-date', admissionDate, style);
        updateDischargeDateById('admission-date-value', admissionDate, style);

        // Fallback: Update by searching for text patterns
        updateDatesByText(dischargeDate, admissionDate, style);

        console.log('✓ Dates updated successfully!');
    }

    /**
     * Initialize and update all dates
     */
    function init() {
        console.log("Initializing Date Updater...");
        console.log("Configuration loaded from embedded data");

        // Update dates immediately
        updateDates();
    }

    // Initialize the script immediately
    // Check if DOM is already ready
    if (document.readyState === 'loading') {
        // DOM is still loading, wait for it
        document.addEventListener('DOMContentLoaded', function () {
            console.log("DOM loaded, starting initialization...");
            init();
        });
    } else {
        // DOM is already ready, initialize immediately
        console.log("DOM already ready, starting initialization...");
        init();
    }

    // Export functions for manual use if needed
    window.BillDateUpdater = {
        updateDischargeDateById: updateDischargeDateById,
        formatDateStyle1: formatDateStyle1,
        formatDateStyle2: formatDateStyle2,
        formatDateStyle3: formatDateStyle3,
        updateAll: updateDates
    };
})();

