// Access Control Test Utility
// This file contains test functions to verify the access control system

import { 
  hasRouteAccess, 
  hasFullAccess, 
  hasCheckAccess, 
  hasApproveAccess, 
  canCreateEdit, 
  getAccessLevel 
} from './routeProtection';

// Test user data with different access levels
const testUsers = {
  admin: {
    id: 1,
    username: 'admin',
    fullname: 'Admin',
    access: 'Admin',
    access_id: 1,
    route_access: [
      { name: 'dashboard', status: 'Full Access' },
      { name: 'access', status: 'Full Access' },
      { name: 'users', status: 'Full Access' },
      { name: 'receipts', status: 'Full Access' },
      { name: 'sales', status: 'Full Access' },
      { name: 'collections', status: 'Full Access' },
      { name: 'disbursements', status: 'Full Access' }
    ]
  },
  checker: {
    id: 2,
    username: 'checker',
    fullname: 'Checker User',
    access: 'Staff',
    access_id: 2,
    route_access: [
      { name: 'dashboard', status: 'Check Access' },
      { name: 'receipts', status: 'Check Access' },
      { name: 'sales', status: 'Check Access' },
      { name: 'collections', status: 'Check Access' },
      { name: 'disbursements', status: 'Check Access' }
    ]
  },
  approver: {
    id: 3,
    username: 'approver',
    fullname: 'Approver User',
    access: 'Manager',
    access_id: 3,
    route_access: [
      { name: 'dashboard', status: 'Approve Access' },
      { name: 'receipts', status: 'Approve Access' },
      { name: 'sales', status: 'Approve Access' },
      { name: 'collections', status: 'Approve Access' },
      { name: 'disbursements', status: 'Approve Access' }
    ]
  },
  noAccess: {
    id: 4,
    username: 'noaccess',
    fullname: 'No Access User',
    access: 'Guest',
    access_id: 4,
    route_access: [
      { name: 'dashboard', status: 'No Access' },
      { name: 'receipts', status: 'No Access' },
      { name: 'sales', status: 'No Access' }
    ]
  }
};

// Test function to verify access control
export function runAccessControlTests() {

  const testRoutes = ['dashboard', 'receipts', 'sales', 'collections', 'disbursements', 'access', 'users'];
  
  Object.entries(testUsers).forEach(([userType, user]) => {

    testRoutes.forEach(route => {
      const hasAccess = hasRouteAccess(route, user);
      const fullAccess = hasFullAccess(route, user);
      const checkAccess = hasCheckAccess(route, user);
      const approveAccess = hasApproveAccess(route, user);
      const canCreate = canCreateEdit(route, user);
      const accessLevel = getAccessLevel(route, user);

    });
  });
  
}

// Test specific scenarios
export function testSpecificScenarios() {

  // Test 1: Admin should have full access to everything
  const admin = testUsers.admin;
  const adminHasFullAccess = admin.route_access.every(route => 
    hasFullAccess(route.name, admin)
  );

  // Test 2: Checker should not be able to create/edit
  const checker = testUsers.checker;
  const checkerCannotCreate = checker.route_access.every(route => 
    !canCreateEdit(route.name, checker)
  );

  // Test 3: Approver should not be able to create/edit
  const approver = testUsers.approver;
  const approverCannotCreate = approver.route_access.every(route => 
    !canCreateEdit(route.name, approver)
  );

  // Test 4: No access user should not have access to any route
  const noAccessUser = testUsers.noAccess;
  const noAccessToRoutes = noAccessUser.route_access.every(route => 
    !hasRouteAccess(route.name, noAccessUser)
  );

}

// Mock localStorage for testing
export function mockLocalStorageTest() {

  // Test setting and getting user data
  Object.entries(testUsers).forEach(([userType, user]) => {
    localStorage.setItem('user', JSON.stringify(user));
    
    const storedUser = JSON.parse(sessionStorage.getItem('auth_user'));
    const isSameUser = storedUser.username === user.username;

    // Test access functions with stored user
    const hasAccessToDashboard = hasRouteAccess('dashboard', storedUser);
  });
  
  localStorage.removeItem('user');
}

// Run all tests
export function runAllTests() {
  runAccessControlTests();
  testSpecificScenarios();
  mockLocalStorageTest();
}
