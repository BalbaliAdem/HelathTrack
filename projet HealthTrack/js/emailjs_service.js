// emailjs_service.js — EmailJS wrapper
(function(){
  // Ensure a global config object exists (can be set/overwritten in email_service.js)
  window.EmailJSConfig = window.EmailJSConfig || { serviceId: '', templateId: '', publicKey: '' };

  window.loadEmailJSSDK = function() {
    if (window.emailjs && typeof window.emailjs.send === 'function') {
      try {
        if (window.EmailJSConfig.publicKey && typeof window.emailjs.init === 'function') window.emailjs.init(window.EmailJSConfig.publicKey);
      } catch (e) {}
      return Promise.resolve(window.emailjs);
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.emailjs.com/sdk/3.2.0/email.min.js';
      s.onload = () => {
        try {
          if (window.emailjs && window.EmailJSConfig.publicKey && typeof window.emailjs.init === 'function') {
            window.emailjs.init(window.EmailJSConfig.publicKey);
          }
          resolve(window.emailjs);
        } catch (e) {
          resolve(window.emailjs);
        }
      };
      s.onerror = () => reject(new Error('Failed to load EmailJS SDK'));
      document.head.appendChild(s);
    });
  };

  window.sendViaEmailJS = function(payload = {}, options = {}) {
    const cfg = Object.assign({}, window.EmailJSConfig, options);
    if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
      return Promise.reject(new Error('EmailJS not configured (serviceId/templateId/publicKey)'));
    }
    return window.loadEmailJSSDK().then(emailjs => {
      if (!emailjs || typeof emailjs.send !== 'function') throw new Error('EmailJS SDK not available');
      // Map payload to template parameters; adapt to your template field names as needed
      const templateParams = Object.assign({
        to_email: payload.to || '',
        subject: payload.subject || '',
        message: payload.body || '',
        from_email: payload.from || '',
        to_name: payload.toName || ''
      }, payload.templateParams || {});
      return emailjs.send(cfg.serviceId, cfg.templateId, templateParams, cfg.publicKey);
    });
  };
})();
