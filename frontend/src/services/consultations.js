import api from '../api'

export const mapConsultation = (consultation) => ({
  id: consultation.id,
  referralId: consultation.referral,
  doctorId: consultation.doctor,
  diagnosis: consultation.diagnosis,
  treatmentPlan: consultation.treatment_plan,
  consultedAt: consultation.consulted_at,
})

export const fetchConsultations = async () => {
  const response = await api.get('consultations/')
  return response.data.map(mapConsultation)
}

export const createConsultation = async ({ referralId, diagnosis, treatmentPlan }) => {
  const response = await api.post('consultations/', {
    referral: referralId,
    diagnosis,
    treatment_plan: treatmentPlan,
  })
  return mapConsultation(response.data)
}

export const updateConsultation = async (id, { diagnosis, treatmentPlan }) => {
  const response = await api.patch(`consultations/${id}/`, { diagnosis, treatment_plan: treatmentPlan })
  return mapConsultation(response.data)
}
