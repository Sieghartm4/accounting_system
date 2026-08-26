// API base URL
const API_BASE = window.location.origin;

// Current user
let currentUser = null;

// Current action for confirm modal
let currentAction = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for token and user in URL parameters (from login redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const userParam = urlParams.get('user');
    
    if (tokenParam && userParam) {
        localStorage.setItem('token', tokenParam);
        localStorage.setItem('user', decodeURIComponent(userParam));
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    checkAuth();
    setupTabs();
    setupPlanForm();
});

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user) {
        // Redirect to main client login page
        // Get client URL from environment variable or use default
        const clientUrl = window.CLIENT_URL || window.location.origin.replace(/:\d+/, ':5050');
        window.location.href = `${clientUrl}/login`;
        return;
    }
    
    currentUser = user;
    document.getElementById('username').textContent = user.username || user.fullname || 'User';
    
    // Fetch data
    fetchSubscriptionPlans();
    fetchMasterUsers();
}

// Setup tabs
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tab}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// Setup plan form
function setupPlanForm() {
    const form = document.getElementById('plan-form');
    form.addEventListener('submit', handlePlanSubmit);
}

// Fetch subscription plans
async function fetchSubscriptionPlans() {
    try {
        const response = await fetch(`${API_BASE}/subscription-plans`);
        const data = await response.json();
        
        if (data.success) {
            renderPlansTable(data.data);
        } else {
            showToast('Failed to fetch subscription plans', 'error');
        }
    } catch (error) {
        console.error('Error fetching plans:', error);
        showToast('Error fetching subscription plans', 'error');
    }
}

// Render plans table
function renderPlansTable(plans) {
    const tbody = document.querySelector('#plans-table tbody');
    tbody.innerHTML = '';
    
    plans.forEach(plan => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${plan.sp_code || ''}</td>
            <td>${plan.sp_name || ''}</td>
            <td>₱${parseFloat(plan.sp_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
            <td>${plan.sp_description || '-'}</td>
            <td>
                <span class="badge ${plan.sp_is_active ? 'badge-success' : 'badge-danger'}">
                    ${plan.sp_is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="editPlan(${plan.sp_id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deletePlan(${plan.sp_id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Fetch master users
async function fetchMasterUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`);
        const data = await response.json();
        
        if (data.success) {
            renderUsersTable(data.data);
        } else {
            showToast('Failed to fetch master users', 'error');
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        showToast('Error fetching master users', 'error');
    }
}

// Render users table
function renderUsersTable(users) {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.username || ''}</td>
            <td>${user.email || '-'}</td>
            <td>${user.db_name || '-'}</td>
            <td>
                <span class="badge ${user.role === 'ADMIN' ? 'badge-info' : 'badge-warning'}">
                    ${user.role || 'USER'}
                </span>
            </td>
            <td>
                <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}">
                    ${user.status || 'inactive'}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Open plan modal
function openPlanModal(plan = null) {
    const modal = document.getElementById('plan-modal');
    const form = document.getElementById('plan-form');
    const title = document.getElementById('modal-title');
    
    form.reset();
    document.getElementById('plan-items-container').innerHTML = `
        <div class="plan-item">
            <input type="text" placeholder="Item name" class="item-name">
            <button type="button" class="btn btn-danger btn-sm" onclick="removePlanItem(this)">Remove</button>
        </div>
    `;
    
    if (plan) {
        title.textContent = 'Edit Subscription Plan';
        document.getElementById('plan-id').value = plan.sp_id;
        document.getElementById('plan-code').value = plan.sp_code || '';
        document.getElementById('plan-name').value = plan.sp_name || '';
        document.getElementById('plan-price').value = plan.sp_price || '';
        document.getElementById('plan-description').value = plan.sp_description || '';
        document.getElementById('plan-active').checked = plan.sp_is_active;
        
        // Load plan items if available
        if (plan.items && plan.items.length > 0) {
            document.getElementById('plan-items-container').innerHTML = '';
            plan.items.forEach(item => {
                addPlanItem(item.spi_item_name || '');
            });
        }
    } else {
        title.textContent = 'New Subscription Plan';
        document.getElementById('plan-id').value = '';
    }
    
    modal.classList.add('active');
}

// Close plan modal
function closePlanModal() {
    const modal = document.getElementById('plan-modal');
    modal.classList.remove('active');
}

// Add plan item
function addPlanItem(value = '') {
    const container = document.getElementById('plan-items-container');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'plan-item';
    itemDiv.innerHTML = `
        <input type="text" placeholder="Item name" class="item-name" value="${value}">
        <button type="button" class="btn btn-danger btn-sm" onclick="removePlanItem(this)">Remove</button>
    `;
    container.appendChild(itemDiv);
}

// Remove plan item
function removePlanItem(button) {
    const container = document.getElementById('plan-items-container');
    if (container.children.length > 1) {
        button.parentElement.remove();
    }
}

// Handle plan submit
async function handlePlanSubmit(e) {
    e.preventDefault();
    
    const planId = document.getElementById('plan-id').value;
    const planData = {
        sp_code: document.getElementById('plan-code').value,
        sp_name: document.getElementById('plan-name').value,
        sp_price: parseFloat(document.getElementById('plan-price').value),
        sp_description: document.getElementById('plan-description').value,
        sp_is_active: document.getElementById('plan-active').checked,
        items: []
    };
    
    // Collect plan items
    const itemInputs = document.querySelectorAll('.item-name');
    itemInputs.forEach((input, index) => {
        if (input.value.trim()) {
            planData.items.push({
                spi_item_name: input.value.trim(),
                spi_display_order: index + 1
            });
        }
    });
    
    try {
        const token = localStorage.getItem('token');
        const url = planId ? `${API_BASE}/subscription-plans/${planId}` : `${API_BASE}/subscription-plans`;
        const method = planId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(planData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(planId ? 'Plan updated successfully' : 'Plan created successfully', 'success');
            closePlanModal();
            fetchSubscriptionPlans();
        } else {
            showToast(data.message || 'Failed to save plan', 'error');
        }
    } catch (error) {
        console.error('Error saving plan:', error);
        showToast('Error saving plan', 'error');
    }
}

// Edit plan
function editPlan(planId) {
    fetch(`${API_BASE}/subscription-plans/${planId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                openPlanModal(data.data);
            } else {
                showToast('Failed to fetch plan details', 'error');
            }
        })
        .catch(error => {
            console.error('Error fetching plan:', error);
            showToast('Error fetching plan details', 'error');
        });
}

// Delete plan
function deletePlan(planId) {
    currentAction = () => {
        const token = localStorage.getItem('token');
        fetch(`${API_BASE}/subscription-plans/${planId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Plan deleted successfully', 'success');
                fetchSubscriptionPlans();
            } else {
                showToast(data.message || 'Failed to delete plan', 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting plan:', error);
            showToast('Error deleting plan', 'error');
        });
    };
    
    document.getElementById('confirm-message').textContent = 'Are you sure you want to delete this plan?';
    document.getElementById('confirm-modal').classList.add('active');
}

// Close confirm modal
function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    currentAction = null;
}

// Confirm action
function confirmAction() {
    if (currentAction) {
        currentAction();
    }
    closeConfirmModal();
}

// Show toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}
