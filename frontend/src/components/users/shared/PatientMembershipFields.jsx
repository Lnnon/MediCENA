import { createContext, useContext, useState } from 'react'
import './PatientFormFields.css'

const MembershipContext = createContext(null)
const normalizeStatus = (value) => ['None', 'Member', 'Dependent'].find((option) => option.toLowerCase() === String(value || '').trim().toLowerCase()) || 'None'

export function PatientMembershipProvider({ patient = {}, children }) {
  const [status, setStatus] = useState(() => normalizeStatus(patient.philHealthStatus))
  const [dependent, setDependent] = useState(() => ({ ...patient.dependentInformation }))
  return <MembershipContext.Provider value={{ status, setStatus, dependent, setDependent, patient }}>{children}</MembershipContext.Provider>
}

export default function PatientMembershipFields() {
  const { status, setStatus, patient } = useContext(MembershipContext)
  return <>
    <label><span>PhilHealth Status</span><select name="philHealthStatus" value={status} onChange={(event) => setStatus(event.target.value)}>{['None', 'Member', 'Dependent'].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label><span>PhilHealth ID</span><input name="philHealthId" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 12) }} defaultValue={patient.philHealthId || ''} maxLength={12} inputMode="numeric" pattern="[0-9]{1,12}" title="Enter up to 12 digits only" placeholder="If applicable" /></label>
  </>
}

export function DependentInformationFields() {
  const { status, dependent, setDependent } = useContext(MembershipContext)
  if (status !== 'Dependent') return null
  const savedDate = (dependent.date_of_birth || '').split('-')
  const birth = dependent.birthParts || { year: savedDate[0] || '', month: savedDate[1] || '', day: savedDate[2] || '' }
  const updateBirth = (key, value) => setDependent((current) => {
    const parts = { ...birth, [key]: value }
    return { ...current, birthParts: parts, date_of_birth: parts.year && parts.month && parts.day ? `${parts.year}-${parts.month}-${parts.day.padStart(2, '0')}` : '' }
  })
  const hasBirthPart = Boolean(birth.year || birth.month || birth.day)
  const field = (key) => ({ name: `dependent_${key}`, value: dependent[key] || '', onChange: (event) => setDependent((current) => ({ ...current, [key]: key === 'phic_id' ? event.target.value.replace(/[^0-9]/g, '').slice(0, 12) : event.target.value })) })
  return <fieldset className="patient-dependent-fields">
    <legend>Dependent Information</legend>
    <div>{[['last_name', 'Last Name'], ['first_name', 'First Name'], ['suffix', 'Suffix'], ['middle_name', 'Middle Name']].map(([key, label]) => <label key={key}><span>{label}</span><input {...field(key)} maxLength={150} placeholder={label} /></label>)}
      <label className="dependent-birth-field"><span>Birth Date</span><input type="hidden" name="dependent_date_of_birth" value={dependent.date_of_birth || ''} /><div className="birth-date-fields"><select aria-label="Dependent birth month" value={birth.month} required={hasBirthPart} onChange={(event) => updateBirth('month', event.target.value)}><option value="">Month</option>{['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>)}</select><input type="number" aria-label="Dependent birth day" placeholder="Day" min="1" max="31" value={birth.day} required={hasBirthPart} onChange={(event) => updateBirth('day', event.target.value)} /><input type="number" aria-label="Dependent birth year" placeholder="Year" min="1900" max={new Date().getFullYear()} value={birth.year} required={hasBirthPart} onChange={(event) => updateBirth('year', event.target.value)} /></div></label>
      <fieldset className="dependent-sex-options"><legend>Sex</legend>{['Male', 'Female'].map((sex) => <label key={sex}><input {...field('sex')} type="radio" value={sex} checked={dependent.sex === sex} />{sex}</label>)}</fieldset>
    </div>
  </fieldset>
}
