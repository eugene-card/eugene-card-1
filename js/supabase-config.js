/* Eugene Card — canonical Supabase configuration shared by every page. */
(function () {
  const config = {
    url: 'https://tsjgvzpzfjyecnginipt.supabase.co',
    publishableKey: 'sb_publishable_o3oWlPh_EPj5xd0GBjDWYQ_UhVicSH3',
    adminEmails: ['eugene.aquila06@gmail.com', 'eugenecard.market@gmail.com']
  };
  window.EUGENE_SUPABASE_CONFIG = Object.freeze(config);
  window.isEugeneAdminEmail = email => config.adminEmails.includes(String(email || '').trim().toLowerCase());
})();
