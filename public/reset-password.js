// Reset Password Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('resetPasswordForm');
    const errorPage = document.getElementById('errorPage');
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const messageDiv = document.getElementById('message');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const passwordStrengthDiv = document.getElementById('passwordStrength');
    const closePageLink = document.getElementById('closePageLink');

    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Check if token exists
    if (!token) {
        showError('Invalid token. Please check the link in your email.');
    } else {
        // Show form if token exists
        form.style.display = 'block';
    }

    // Add event listener for close page link
    closePageLink.addEventListener('click', function(e) {
        e.preventDefault();
        window.close();
    });

    // Password strength checker
    newPasswordInput.addEventListener('input', function() {
        const password = this.value;
        const strength = checkPasswordStrength(password);
        passwordStrengthDiv.textContent = strength.text;
        passwordStrengthDiv.className = `password-strength strength-${strength.level}`;
    });

    function checkPasswordStrength(password) {
        if (password.length < 6) {
            return { level: 'weak', text: 'Password too short (minimum 6 characters)' };
        } else if (password.length < 8) {
            return { level: 'medium', text: 'Medium password strength' };
        } else if (password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)) {
            return { level: 'strong', text: 'Strong password' };
        } else {
            return { level: 'medium', text: 'Good password strength' };
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            showMessage('error', 'Passwords do not match!');
            return;
        }

        if (newPassword.length < 6) {
            showMessage('error', 'Password must be at least 6 characters!');
            return;
        }

        // Show loading
        submitBtn.disabled = true;
        loading.style.display = 'block';
        messageDiv.innerHTML = '';

        try {
            const response = await fetch('/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    token: token,
                    newPassword: newPassword 
                })
            });

            const result = await response.json();

            if (result.status === 0) {
                showMessage('success', '✅ Password reset successfully! You can close this page and login again with your new password.');
                
                // Clear form
                form.reset();
                passwordStrengthDiv.textContent = '';
                
                // Auto close after 3 seconds
                setTimeout(() => {
                    window.close();
                }, 3000);
            } else {
                showError(result.data?.message || result.message || 'Invalid or expired token. Please request a new password reset.');
            }
        } catch (error) {
            showMessage('error', 'Unable to connect to server. Please try again later.');
        } finally {
            submitBtn.disabled = false;
            loading.style.display = 'none';
        }
    });

    function showMessage(type, text) {
        messageDiv.innerHTML = `<div class="message ${type}">${text}</div>`;
    }

    function showError(message) {
        errorPage.style.display = 'block';
        form.style.display = 'none';
        document.getElementById('errorMessage').textContent = message;
    }
});
