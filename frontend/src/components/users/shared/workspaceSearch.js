import { fetchPatients } from '../../../services/patients'
import { fetchReferrals } from '../../../services/referrals'
import { fetchDoctors, fetchStaffUsers, fetchStaffActivities } from '../../../services/users'
import { fetchDiseases } from '../../../services/gis'
import { fetchConsultations } from '../../../services/consultations'
import {
  fetchMedicineInventory, fetchMedicineRequestsForBhc, fetchMedicineRequestsForCho,
  fetchPatientMedicineRequests, fetchPatientMedicineDistributions,
} from '../../../services/medicines'

// Each source uses the same authenticated service as the corresponding role page.
// Project only fields displayed in search; patient account credentials stay excluded.
export async function loadWorkspaceRecords(role) {
  const sources = []
  function add(type, load, title, fields) {
    sources.push(load().then((rows) => rows.map((row) => ({
      key: type + '-' + row.id, type, label: title(row),
      details: Object.entries(fields).map(([label, key]) => [label, row[key]])
        .filter(([, value]) => value !== undefined && value !== null && value !== ''),
    }))))
  }
  if (['patient', 'doctor', 'bhc', 'cho', 'opd'].includes(role)) {
    add('Referral', fetchReferrals, (r) => r.code + ' · ' + r.patient, {
      Barangay: 'barangay', Specialty: 'specialty', Reason: 'chiefComplaint', Status: 'status',
      Doctor: 'assignedDoctor', From: 'referredFrom', Date: 'date',
    })
  }
  if (['bhc', 'cho', 'doctor'].includes(role)) {
    add('Patient', fetchPatients, (r) => r.name, { Barangay: 'barangay', Age: 'age', Contact: 'contactNumber' })
  }
  if (['bhc', 'cho', 'pharmacist'].includes(role)) {
    add('Inventory', () => fetchMedicineInventory(role === 'cho'), (r) => r.name, {
      Code: 'id', Facility: 'facility', Category: 'category', Dosage: 'dosage', Stock: 'stocks',
    })
    add('Supply request', role === 'bhc' ? fetchMedicineRequestsForBhc : fetchMedicineRequestsForCho,
      (r) => r.medicineName || r.medicine, { Code: 'id', Barangay: role === 'bhc' ? 'address' : 'barangay', Quantity: 'quantity', Status: 'status' })
  }
  if (['patient', 'bhc'].includes(role)) {
    add('Medicine request', fetchPatientMedicineRequests, (r) => r.medicineName, { Code: 'id', Patient: 'patientName', Quantity: 'quantity', Status: 'status' })
  }
  if (['patient', 'bhc', 'cho'].includes(role)) {
    add('Distribution', fetchPatientMedicineDistributions, (r) => r.medicineName, { Patient: 'patientName', Barangay: 'barangay', Facility: 'facility', Quantity: 'quantity', Date: 'distributedAt' })
  }
  if (role === 'opd') add('Doctor', fetchDoctors, (r) => r.name, { Specialty: 'specialty', Facility: 'facility' })
  if (role === 'doctor') add('Consultation', fetchConsultations, (r) => 'Consultation · REF-' + String(r.referralId).padStart(6, '0'), { Diagnosis: 'diagnosis', Plan: 'treatmentPlan', Date: 'consultedAt' })
  if (role === 'cho') add('Staff', fetchStaffUsers, (r) => r.name, { Role: 'department', Specialty: 'specialty', Barangay: 'barangayDesignation', Status: 'status' })
  if (['cho', 'bhc'].includes(role)) add('Disease', fetchDiseases, (r) => r.disease_name, { Category: 'category' })
  if (role === 'cho') add('Personnel activity', fetchStaffActivities,
    (r) => [r.actor_detail?.username, r.action, r.resource].filter(Boolean).join(' · '), { Record: 'object_id', Date: 'created_at' })
  const results = await Promise.allSettled(sources)
  return {
    records: results.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
    partial: results.some((result) => result.status === 'rejected'),
  }
}
