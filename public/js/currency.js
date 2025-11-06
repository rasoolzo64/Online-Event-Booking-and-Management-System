// js/currency.js - Currency formatting utilities
function formatRupees(amount) {
    return `₹${parseFloat(amount).toLocaleString('en-IN')}`;
}

function formatRupeesWithDecimal(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

// Global currency formatter
window.formatCurrency = formatRupees;
window.formatCurrencyDecimal = formatRupeesWithDecimal;