const formatCurrency = (amount) => {
  return `Rs. ${parseFloat(amount).toFixed(2)}`;
};

const formatCurrencyWithLocale = (amount) => {
  return amount.toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

module.exports = {
  formatCurrency,
  formatCurrencyWithLocale
}; 