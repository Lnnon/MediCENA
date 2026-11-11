import api from '../api'

const formatBirthDate = (dateValue) => {
  if (!dateValue) return 'No DOB'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(dateValue))
}

const getAge = (dateValue) => {
  if (!dateValue) return 'Age not set'

  const birthDate = new Date(dateValue)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return `${age} years old`
}

const getPatientName = (profile) => {
  const fullName = [
    profile.user?.first_name,
    profile.user?.last_name,
  ].filter(Boolean).join(' ')

  return fullName || profile.user?.username || `Patient ${profile.id}`
}

const getBirthDateFromForm = (formData) => {
  const birthDate = formData.get('birthDate')

  if (birthDate) return birthDate

  const month = formData.get('birthMonth')
  const day = formData.get('birthDay')?.padStart(2, '0')
  const year = formData.get('birthYear')

  if (!month || !day || !year) return null

  return `${year}-${month}-${day}`
}

export const mapPatientProfile = (profile) => ({
  id: profile.id,
  name: getPatientName(profile),
  contactNumber: profile.contact_number || 'No contact number',
  gender: profile.sex || 'Not set',
  civilStatus: profile.civil_status || 'Not set',
  age: getAge(profile.date_of_birth),
  dateOfBirth: profile.date_of_birth || '',
  birthDate: formatBirthDate(profile.date_of_birth),
  philHealthStatus: profile.philhealth_status || 'None',
  dependentInformation: profile.dependent_information || {},
  philHealthId: profile.philhealth_id || '',
  barangay: profile.barangay || 'No barangay',
  municipality: profile.municipality || 'Lucena City',
  province: profile.province || 'Quezon',
  region: profile.region || 'Region IV-A',
  address: profile.address || 'Lucena City, Quezon',
  username: profile.user?.username || '',
  generatedPassword: profile.generated_password || '',
  wasExistingRecord: Boolean(profile.was_existing_record),
  medicineDistributions: (profile.medicine_distributions || []).map((distribution) => ({
    id: distribution.id,
    medicineName: distribution.medicine_detail?.name || 'Medicine',
    dosage: distribution.medicine_detail?.dosage || '',
    quantity: Number(distribution.quantity || 0),
    instructions: distribution.instructions || '',
    notes: distribution.notes || '',
    distributedAt: String(distribution.distributed_at || '').slice(0, 10),
    distributedBy: [
      distribution.distributed_by_detail?.first_name,
      distribution.distributed_by_detail?.last_name,
    ].filter(Boolean).join(' ') || distribution.distributed_by_detail?.username || '',
  })),
})

export const fetchPatients = async () => {
  const response = await api.get('patient-profiles/')
  return response.data.map(mapPatientProfile)
}

export const createPatient = async (formData) => {
  const payload = {
    first_name: formData.get('firstName')?.trim(),
    middle_name: formData.get('middleName')?.trim(),
    last_name: formData.get('lastName')?.trim(),
    contact_number: formData.get('contactNumber') || '',
    date_of_birth: getBirthDateFromForm(formData),
    sex: formData.get('sex') || '',
    civil_status: formData.get('civilStatus') || 'Single',
    philhealth_status: formData.get('philHealthStatus') || 'None',
    philhealth_id: formData.get('philHealthId') || '',
    ...(formData.get('philHealthStatus') === 'Dependent' ? { dependent_information: Object.fromEntries(['last_name', 'first_name', 'suffix', 'middle_name', 'date_of_birth', 'sex'].map((key) => [key, formData.get('dependent_' + key) || (key === 'date_of_birth' ? null : '')])) } : {}),
    region: 'Region IV-A',
    province: 'Quezon',
    municipality: 'Lucena City',
    barangay: formData.get('barangay') || '',
  }

  payload.address = [payload.barangay, payload.municipality, payload.province]
    .filter(Boolean)
    .join(', ')

  const response = await api.post('patient-profiles/', payload)
  return mapPatientProfile(response.data)
}

export const updatePatient = async (patientId, formData) => {
  const payload = {
    contact_number: formData.get('contactNumber') || '',
    date_of_birth: getBirthDateFromForm(formData),
    sex: formData.get('sex') || '',
    civil_status: formData.get('civilStatus') || 'Single',
    philhealth_status: formData.get('philHealthStatus') || 'None',
    philhealth_id: formData.get('philHealthId') || '',
    ...(formData.get('philHealthStatus') === 'Dependent' ? { dependent_information: Object.fromEntries(['last_name', 'first_name', 'suffix', 'middle_name', 'date_of_birth', 'sex'].map((key) => [key, formData.get('dependent_' + key) || (key === 'date_of_birth' ? null : '')])) } : {}),
  }

  if (payload.dependent_information) {
    const existing = await api.get(`patient-profiles/${patientId}/`)
    payload.dependent_information = { ...existing.data.dependent_information, ...payload.dependent_information }
  }
  const response = await api.patch(`patient-profiles/${patientId}/`, payload)
  return mapPatientProfile(response.data)
}
