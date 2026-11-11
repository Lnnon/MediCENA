import api, { getShared } from '../api'

const getFullName = (user) => {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  return name || user?.username || 'Unassigned'
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

  return age
}

const getValueOrNotSet = (value) => value || 'Not set'

export const mapReferral = (referral) => {
  const patientProfile = referral.patient_detail
  const patientUser = patientProfile?.user

  return {
    id: referral.id,
    code: `REF-${String(referral.id).padStart(6, '0')}`,
    patientId: patientProfile?.id || null,
    assignedDoctorId: referral.assigned_doctor || null,
    consultationDetails: referral.consultation_details || [],
    patient: getFullName(patientUser),
    age: getAge(patientProfile?.date_of_birth),
    sex: patientProfile?.sex || 'Not set',
    birthDate: patientProfile?.date_of_birth || '',
    barangay: patientProfile?.barangay || 'No barangay',
    contactNumber: patientProfile?.contact_number || 'No contact number',
    assignedDoctor: referral.assigned_doctor_detail
      ? getFullName(referral.assigned_doctor_detail)
      : 'Unassigned',
    specialty: referral.specialty || referral.reason || 'For assessment',
    referredFrom: referral.source_facility_detail?.name || 'Source facility not set',
    referredTo: referral.destination_facility_detail?.name || 'Destination facility not set',
    referredBy: getFullName(referral.referred_by_detail),
    chiefComplaint: referral.reason || 'For assessment',
    weight: getValueOrNotSet(referral.weight),
    temperature: getValueOrNotSet(referral.temperature),
    bp: getValueOrNotSet(referral.blood_pressure),
    o2sat: getValueOrNotSet(referral.oxygen_saturation),
    height: getValueOrNotSet(referral.height),
    respirationRate: getValueOrNotSet(referral.respiration_rate),
    cardiacRate: getValueOrNotSet(referral.cardiac_rate),
    ekonsultEncounter: referral.ekonsult_encounter || 'No',
    visitNumber: referral.visit_number || 'Not indicated',
    profiledAtBhs: referral.profiled_at_bhs || 'No',
    otherDiagnosis: referral.other_diagnosis || '',
    callTakenBy: referral.call_taken_by || '',
    purokFid: referral.purok_fid || '',
    purokName: referral.purok_name || '',
    date: referral.created_at,
    status: referral.status,
  }
}

export const fetchReferrals = async () => {
  const response = await getShared('referrals/')
  return response.data.map(mapReferral)
}

export const updateReferral = async (referralId, payload) => {
  const response = await api.patch(`referrals/${referralId}/`, payload)
  return mapReferral(response.data)
}

export const mapIncomingReferral = (referral) => {
  const patientProfile = referral.patient_detail
  const patientUser = patientProfile?.user
  const referredBy = referral.referred_by_detail
  const sourceFacility = referral.source_facility_detail

  return {
    id: `INC-${String(referral.id).padStart(6, '0')}`,
    backendId: referral.id,
    assignedDoctorId: referral.assigned_doctor || null,
    patient: getFullName(patientUser),
    age: getAge(patientProfile?.date_of_birth),
    sex: patientProfile?.sex || 'Not set',
    barangay: patientProfile?.barangay || 'No barangay',
    source: sourceFacility?.name || 'Source facility not set',
    referredBy: getFullName(referredBy),
    department: referral.specialty || 'General',
    specialty: referral.specialty || 'General',
    chiefComplaint: referral.reason || 'For assessment',
    vitalSigns: [
      `Weight ${getValueOrNotSet(referral.weight)}`,
      `Temp ${getValueOrNotSet(referral.temperature)}`,
      `BP ${getValueOrNotSet(referral.blood_pressure)}`,
      `O2 ${getValueOrNotSet(referral.oxygen_saturation)}`,
      `Height ${getValueOrNotSet(referral.height)}`,
      `RR ${getValueOrNotSet(referral.respiration_rate)}`,
      `CR ${getValueOrNotSet(referral.cardiac_rate)}`,
    ].join(', '),
    weight: getValueOrNotSet(referral.weight),
    temperature: getValueOrNotSet(referral.temperature),
    bp: getValueOrNotSet(referral.blood_pressure),
    o2sat: getValueOrNotSet(referral.oxygen_saturation),
    height: getValueOrNotSet(referral.height),
    respirationRate: getValueOrNotSet(referral.respiration_rate),
    cardiacRate: getValueOrNotSet(referral.cardiac_rate),
    ekonsultEncounter: referral.ekonsult_encounter || 'No',
    visitNumber: referral.visit_number || 'Not indicated',
    profiledAtBhs: referral.profiled_at_bhs || 'No',
    status: referral.status,
    purokFid: referral.purok_fid || '',
    purokName: referral.purok_name || '',
    time: referral.created_at,
  }
}

export const fetchOpdReferrals = async () => {
  const response = await getShared('referrals/')
  return response.data
    .filter((referral) => referral.destination_facility_detail?.facility_type === 'cho')
    .map(mapIncomingReferral)
}

export const fetchIncomingReferrals = async () => {
  const response = await getShared('referrals/')
  return response.data
    .filter((referral) =>
      referral.destination_facility_detail?.facility_type === 'cho' &&
      ['pending', 'seen'].includes(referral.status) &&
      !referral.assigned_doctor
    )
    .map(mapIncomingReferral)
}

export const createReferral = async (referral) => {
  const payload = {
    patient: referral.patient.id,
    destination_facility: referral.destinationFacilityId,
    specialty: referral.specialty,
    reason: referral.chiefComplaint || referral.notes || 'For assessment',
    weight: referral.weight === 'Not set' ? '' : referral.weight,
    temperature: referral.temperature === 'Not set' ? '' : referral.temperature,
    blood_pressure: referral.bp === 'Not set' ? '' : referral.bp,
    oxygen_saturation: referral.o2sat === 'Not set' ? '' : referral.o2sat,
    height: referral.height === 'Not set' ? '' : referral.height,
    respiration_rate: referral.respirationRate === 'Not set' ? '' : referral.respirationRate,
    cardiac_rate: referral.cardiacRate === 'Not set' ? '' : referral.cardiacRate,
    ekonsult_encounter: referral.ekonsultEncounter || 'No',
    visit_number: referral.visitNumber === 'Not indicated' ? '' : referral.visitNumber,
    profiled_at_bhs: referral.profiledAtBhs || 'No',
    other_diagnosis: referral.otherDiagnosis || '',
    call_taken_by: referral.callTakenBy || '',
    purok_fid: referral.purokFid || null,
    purok_name: referral.purokName || '',
    status: 'pending',
  }

  const response = await api.post('referrals/', payload)
  return mapReferral(response.data)
}
