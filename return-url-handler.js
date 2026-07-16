
    // return-url-handler.js
    // Handles return URL functionality across all pages
    
    (function() {
        'use strict';
        
        // Configuration
        const CONFIG = {
            authPages: ['login', 'signup', 'verify', 'reset', 'check-verification'],
            defaultReturnUrl: '/index.html',
            storageKey: 'returnUrl'
        };
        
        // Get return URL from various sources
        function getReturnUrl() {
            // 1. Check URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            let returnUrl = urlParams.get('returnUrl');
            
            // 2. Check session storage
            if (!returnUrl) {
                returnUrl = sessionStorage.getItem(CONFIG.storageKey);
            }
            
            // 3. Check localStorage (persistent across sessions)
            if (!returnUrl) {
                returnUrl = localStorage.getItem(CONFIG.storageKey);
            }
            
            // 4. Check referrer
            if (!returnUrl || returnUrl === 'null' || returnUrl === 'undefined') {
                returnUrl = document.referrer || CONFIG.defaultReturnUrl;
            }
            
            // Clean up
            if (returnUrl) {
                // Remove query parameters
                returnUrl = returnUrl.split('?')[0];
                // Remove hash
                returnUrl = returnUrl.split('#')[0];
                
                // Make sure it starts with /
                if (!returnUrl.startsWith('/') && !returnUrl.startsWith('http')) {
                    returnUrl = '/' + returnUrl;
                }
                
                // Prevent redirect loops by excluding auth pages
                if (CONFIG.authPages.some(page => returnUrl.includes(page))) {
                    returnUrl = CONFIG.defaultReturnUrl;
                }
            }
            
            return returnUrl || CONFIG.defaultReturnUrl;
        }
        
        // Set return URL
        function setReturnUrl(url) {
            if (url && !CONFIG.authPages.some(page => url.includes(page))) {
                sessionStorage.setItem(CONFIG.storageKey, url);
                localStorage.setItem(CONFIG.storageKey, url);
            }
        }
        
        // Clear return URL after use
        function clearReturnUrl() {
            sessionStorage.removeItem(CONFIG.storageKey);
            // Keep in localStorage for persistence, but we can clear it too if needed
            // localStorage.removeItem(CONFIG.storageKey);
        }
        
        // Redirect to return URL
        function redirectToReturnUrl() {
            const returnUrl = getReturnUrl();
            clearReturnUrl();
            window.location.href = returnUrl;
        }
        
        // Store current page before navigating
        function storeCurrentPage() {
            const currentPath = window.location.pathname;
            if (currentPath && !CONFIG.authPages.some(page => currentPath.includes(page))) {
                setReturnUrl(currentPath);
            }
        }
        
        // Initialize
        function init() {
            // If on auth page, get return URL from query params
            const currentPath = window.location.pathname;
            if (CONFIG.authPages.some(page => currentPath.includes(page))) {
                const returnUrl = getReturnUrl();
                setReturnUrl(returnUrl);
            }
            
            // Intercept all clicks to store return URL
            document.addEventListener('click', function(e) {
                const link = e.target.closest('a');
                if (link) {
                    const href = link.getAttribute('href');
                    if (href && CONFIG.authPages.some(page => href.includes(page))) {
                        storeCurrentPage();
                    }
                }
            });
            
            // Intercept form submissions
            document.addEventListener('submit', function(e) {
                const form = e.target;
                if (form && CONFIG.authPages.some(page => form.action.includes(page))) {
                    storeCurrentPage();
                    
                    // Add returnUrl to form if not present
                    let returnInput = form.querySelector('input[name="returnUrl"]');
                    if (!returnInput) {
                        returnInput = document.createElement('input');
                        returnInput.type = 'hidden';
                        returnInput.name = 'returnUrl';
                        form.appendChild(returnInput);
                    }
                    returnInput.value = getReturnUrl();
                }
            });
            
            // Make functions globally available
            window.ReturnUrlHandler = {
                getReturnUrl: getReturnUrl,
                setReturnUrl: setReturnUrl,
                clearReturnUrl: clearReturnUrl,
                redirectToReturnUrl: redirectToReturnUrl,
                storeCurrentPage: storeCurrentPage
            };
            
            // Auto-redirect after successful auth if indicated
            if (window.location.search.includes('auth=success')) {
                setTimeout(redirectToReturnUrl, 500);
            }
            
            console.log('✅ Return URL Handler initialized');
        }
        
        // Run on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    })();
    