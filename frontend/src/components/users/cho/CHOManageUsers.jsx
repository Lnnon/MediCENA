import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Filter, Plus, Search, UserPlus, X } from 'lucide-react'
import { createStaffUser, fetchLucenaBarangays, fetchStaffUsers, setStaffActive } from '../../../services/users'

const staffTypes = ['CHO Administrator', 'OPD Personnel', 'Pharmacist', 'Doctor', 'Barangay Health Worker']
const addUserTypes = staffTypes.filter((type) => type !== 'CHO Administrator')

function CHOManageUsers() {
  const [users, setUsers] = useState([])
  const [barangays, setBarangays] = useState([])
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [barangayFilter, setBarangayFilter] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [userType, setUserType] = useState('Doctor')
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [userError, setUserError] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadUsers = async () => {
      try {
        const [backendUsers, lucenaBarangays] = await Promise.all([
          fetchStaffUsers(),
          fetchLucenaBarangays(),
        ])

        if (isMounted) {
          setUsers(backendUsers)
          setBarangays(lucenaBarangays)
          setUserError('')
        }
      } catch {
        if (isMounted) {
          setUserError('Unable to load users from the backend.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false)
        }
      }
    }

    loadUsers()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredUsers = useMemo(() => {
    const searchText = search.trim().toLowerCase()

    return users.filter((user) => {
      const matchesSearch =
        !searchText ||
        [
          user.name,
          user.department,
          user.contact,
          user.username,
          user.specialty,
          user.barangayDesignation,
        ].some((value) => value.toLowerCase().includes(searchText))

      const matchesDepartment = !departmentFilter || user.department === departmentFilter
      const matchesStatus = !statusFilter || user.status === statusFilter
      const matchesBarangay =
        !barangayFilter ||
        user.department !== 'Barangay Health Worker' ||
        user.barangayDesignation === barangayFilter

      return matchesSearch && matchesDepartment && matchesStatus && matchesBarangay
    })
  }, [barangayFilter, departmentFilter, search, statusFilter, users])

  const resetFilters = () => {
    setSearch('')
    setDepartmentFilter('')
    setStatusFilter('')
    setBarangayFilter('')
  }

  const handleAddUser = async (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const password = formData.get('password')
    const confirmPassword = formData.get('confirmPassword')

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }

    try {
      const createdUser = await createStaffUser(formData, userType)
      setUsers((currentUsers) => [createdUser, ...currentUsers])
      setShowAddUser(false)
      setUserType('Doctor')
      setFormError('')
      setUserError('')
    } catch (requestError) {
      const responseErrors = requestError.response?.data
      const message =
        responseErrors?.username?.[0] ||
        responseErrors?.password?.[0] ||
        responseErrors?.email?.[0] ||
        responseErrors?.barangay_designation?.[0] ||
        responseErrors?.non_field_errors?.[0] ||
        'Unable to save user to the backend.'
      setFormError(message)
    }
  }

  return (
    <>
      <div className="cho-page-heading">
        <div>
          <span>Staff & Users</span>
          <h1>Manage Users</h1>
          <p>Manage CHO administrators, OPD personnel, pharmacists, doctors, and BHC staff.</p>
        </div>
      </div>

      <section className="cho-manage-users-panel">
        <div className="cho-manage-toolbar">
          <label>
            <Search size={15} />
            <input
              type="search"
              placeholder="Search name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button className="manage-search-button" type="button">
            <Search size={14} />
            Search
          </button>
          <button
            className="manage-filter-button"
            type="button"
            onClick={() => setShowFilters((current) => !current)}
          >
            <Filter size={14} />
            Filter
          </button>
          <button className="manage-view-button" type="button" onClick={resetFilters}>
            View All
          </button>
          <button className="manage-add-button" type="button" onClick={() => setShowAddUser(true)}>
            <Plus size={14} />
            Add User
          </button>
        </div>

        {showFilters && (
          <div className="cho-manage-filter-row" aria-label="User filters">
            <label>
              <span>Department</span>
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                <option value="">All Departments</option>
                {staffTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All Status</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
            <label>
              <span>Barangay</span>
              <select
                value={barangayFilter}
                onChange={(event) => setBarangayFilter(event.target.value)}
                disabled={departmentFilter !== '' && departmentFilter !== 'Barangay Health Worker'}
              >
                <option value="">All Barangays</option>
                {barangays.map((barangay) => (
                  <option key={barangay}>{barangay}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <h2>
          Manage Users
          <span>{filteredUsers.length}</span>
        </h2>

        {isLoadingUsers ? (
          <div className="patient-alert">
            <AlertTriangle size={16} />
            Loading users...
          </div>
        ) : userError ? (
          <div className="patient-alert">
            <AlertTriangle size={16} />
            {userError}
          </div>
        ) : (
          <div className="cho-manage-users-table-wrap">
            <table className="cho-manage-users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong></td>
                    <td>{user.department}</td>
                    <td>{user.email || 'No email'}</td>
                    <td>{user.contact}</td>
                    <td>{user.username}</td>
                    <td>
                      <span className={`manage-user-status ${user.statusClass}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{user.lastLogin}</td>
                    <td><button type="button" onClick={async () => {
                      try {
                        const updated = await setStaffActive(user.id, user.status !== 'Active')
                        setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
                        setUserError('')
                      } catch { setUserError('Unable to change account access. You cannot deactivate your own account here.') }
                    }}>{user.status === 'Active' ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAddUser && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal cho-user-modal" aria-label="Add user form">
            <header>
              <h2>Add User</h2>
              <button type="button" aria-label="Close add user form" onClick={() => setShowAddUser(false)}>
                <X size={18} />
              </button>
            </header>

            <form className="patient-form cho-user-form" onSubmit={handleAddUser}>
              {formError && (
                <div className="patient-alert">
                  <AlertTriangle size={16} />
                  {formError}
                </div>
              )}

              <div className="cho-user-type-switch">
                {addUserTypes.map((type) => <button key={type} className={userType === type ? 'active' : ''} type="button" onClick={() => setUserType(type)}>{type}</button>)}
              </div>

              <label>
                <span>First Name</span>
                <input name="firstName" type="text" required />
              </label>
              <label>
                <span>Middle Name</span>
                <input name="middleName" type="text" />
              </label>
              <label>
                <span>Last Name</span>
                <input name="lastName" type="text" required />
              </label>
              <label>
                <span>Contact Number</span>
                <input name="contactNumber" type="tel" required />
              </label>
              <label>
                <span>Email Address</span>
                <input name="email" type="email" required />
              </label>

              {userType === 'Doctor' ? (
                <>
                  <label>
                    <span>Designation</span>
                    <input name="designation" type="text" required />
                  </label>
                  <label>
                    <span>Specialty</span>
                    <input name="specialty" type="text" required />
                  </label>
                </>
              ) : userType === 'Barangay Health Worker' ? (
                <label>
                  <span>Barangay Designation</span>
                  <select name="barangayDesignation" defaultValue="" required>
                    <option value="">Select Barangay</option>
                    {barangays.map((barangay) => (
                      <option key={barangay}>{barangay}</option>
                    ))}
                  </select>
                </label>
              ) : <p>Assigned to the Lucena City Health Office. Access follows the selected role.</p>}

              <label>
                <span>Username</span>
                <input name="username" type="text" required />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" required />
              </label>
              <label>
                <span>Confirm Password</span>
                <input name="confirmPassword" type="password" required />
              </label>

              <div className="patient-form-actions">
                <button type="button" onClick={() => setShowAddUser(false)}>
                  <X size={15} />
                  Cancel
                </button>
                <button type="submit">
                  <UserPlus size={15} />
                  Save User
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default CHOManageUsers
