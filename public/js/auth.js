// Light/Dark mode toggle
const toggleBtn = document.getElementById('toggleMode');
if (toggleBtn) {
  toggleBtn.onclick = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  };
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
}

// Status alert function
function showAlert(msg, type = 'success') {
  const alert = document.getElementById('statusAlert');
  if (!alert) return;
  alert.textContent = msg;
  alert.className = `status-alert ${type}`;
  alert.style.display = 'block';
  setTimeout(() => { alert.style.display = 'none'; }, 5000);
}

// Form validation helpers
function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const formGroup = field.closest('.form-group');
  formGroup.classList.add('error');
  
  let errorElement = formGroup.querySelector('.error-message');
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    formGroup.appendChild(errorElement);
  }
  errorElement.textContent = message;
}

function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  const formGroup = field.closest('.form-group');
  formGroup.classList.remove('error');
  const errorElement = formGroup.querySelector('.error-message');
  if (errorElement) {
    errorElement.remove();
  }
}

function clearAllErrors() {
  document.querySelectorAll('.form-group.error').forEach(group => {
    group.classList.remove('error');
    const errorElement = group.querySelector('.error-message');
    if (errorElement) {
      errorElement.remove();
    }
  });
}

// Login form handling
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    if (!email || !password) return;

    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await res.json();

      if (result.success) {
        window.location.href = '/'; // Redirect to main page after successful login
      } else {
        showAlert(result.error, 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      showAlert('Login failed', 'error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
}

// Signup form handling
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();
    
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = document.getElementById('role').value;
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    
    // Validation
    if (!fullName) {
      setFieldError('fullName', 'Full name is required');
      return;
    }
    
    if (!email) {
      setFieldError('email', 'Email is required');
      return;
    }
    
    if (!password) {
      setFieldError('password', 'Password is required');
      return;
    }
    
    if (password.length < 6) {
      setFieldError('password', 'Password must be at least 6 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setFieldError('confirmPassword', 'Passwords do not match');
      return;
    }
    
    if (!role) {
      setFieldError('role', 'Please select a role');
      return;
    }
    
    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    try {
      const response = await fetch('/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          fullName, 
          email, 
          password, 
          role 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showAlert('Account created successfully! Please sign in.', 'success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        showAlert(data.error || 'Signup failed', 'error');
        if (data.field) {
          setFieldError(data.field, data.message || 'Invalid input');
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      showAlert('Network error. Please try again.', 'error');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });
  
  // Clear errors on input
  signupForm.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('input', () => {
      clearFieldError(input.id);
    });
  });
  
  // Password confirmation validation
  const confirmPasswordField = document.getElementById('confirmPassword');
  const passwordField = document.getElementById('password');
  
  if (confirmPasswordField && passwordField) {
    confirmPasswordField.addEventListener('input', () => {
      if (passwordField.value !== confirmPasswordField.value) {
        setFieldError('confirmPassword', 'Passwords do not match');
      } else {
        clearFieldError('confirmPassword');
      }
    });
  }
}