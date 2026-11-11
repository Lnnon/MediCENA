import { compareMedicineInventory } from '../../../services/medicines'
import catalog from '../../../../../backend/core/medicine_catalog.json'
import InventoryMedicineFields from '../shared/InventoryMedicineFields'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CalendarDays, Check, Edit, Filter, PackagePlus, Search, Send, X } from 'lucide-react'
import { fetchMedicineInventory, saveMedicineInventory } from '../../../services/medicines'
import '../pharmacist/PharmacistInventoryUI.css'



function CHOMedicineDistribution({ onDistribute }) {
  const [filters, setFilters] = useState({ search: '', category: '', issued: '' })
  const [medicines, setMedicines] = useState([])
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [medicineForEdit, setMedicineForEdit] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadInventory = async () => {
      try {
        const backendMedicines = await fetchMedicineInventory()
        if (isMounted) {
          setMedicines(backendMedicines)
          setErrorMessage('')
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Unable to load CHO medicine inventory from the backend.')
        }
      }
    }

    loadInventory()

    return () => {
      isMounted = false
    }
  }, [])


  const categories = [...new Set([...catalog.map((item) => item.category), ...medicines.map((medicine) => medicine.category)])]

  const filteredMedicines = useMemo(() => {
    return [...medicines].sort(compareMedicineInventory).filter((medicine) => {
      const searchText = filters.search.toLowerCase()
      const matchesSearch =
        String(medicine.id || '').toLowerCase().includes(searchText) ||
        String(medicine.name || '').toLowerCase().includes(searchText) ||
        String(medicine.type || '').toLowerCase().includes(searchText) ||
        String(medicine.category || '').toLowerCase().includes(searchText)

      return (
        matchesSearch &&
        (!filters.category || medicine.category === filters.category) &&
        (!filters.issued || medicine.issued === filters.issued)
      )
    })
  }, [filters, medicines])

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  const handleSaveMedicine = async (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    if (!formData.get('name')) { setErrorMessage('Select a medicine from the predefined list.'); return }
    const savedMedicine = {
      backendId: medicineForEdit?.backendId,
      formulationVerified: formData.get('formulation_verified') === 'on',
      category: formData.get('category'),
      name: formData.get('name'),
      type: formData.get('type'),
      dosage: formData.get('dosage'),
      stocks: Number(formData.get('stocks') || 0),
      issued: formData.get('issued'),
      expiry: formData.get('expiry'),
    }

    try {
      setIsSaving(true)
      const backendMedicine = await saveMedicineInventory(savedMedicine)
      setMedicines((currentMedicines) => {
        const exists = currentMedicines.some((medicine) => medicine.backendId === backendMedicine.backendId)
        if (!exists) return [backendMedicine, ...currentMedicines]
        return currentMedicines.map((medicine) =>
          medicine.backendId === backendMedicine.backendId ? backendMedicine : medicine,
        )
      })
      setShowAddMedicine(false)
      setMedicineForEdit(null)
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to save CHO medicine inventory.')
    } finally {
      setIsSaving(false)
    }
  }

  const openEditMedicine = (medicine) => {
    setMedicineForEdit(medicine)
    setShowAddMedicine(true)
  }

  const closeMedicineForm = () => {
    setShowAddMedicine(false)
    setMedicineForEdit(null)
  }

  return (
    <div className="pharma-inventory-ui">
      <div className="cho-page-heading">
        <div>
          <span>Medicine</span>
          <h1>Medicine Inventory</h1>
          <p>List of available medicine for CHO distribution.</p>
        </div>
      </div>

      <section className="cho-patient-page cho-inventory-page">
        <aside className="cho-filter-panel">
          <h2>Filter Medicine</h2>
          <label>
            <span>Search</span>
            <div>
              <Search size={15} />
              <input
                type="search"
                placeholder="Search medicine..."
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>Category</span>
            <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Date Issued</span>
            <div>
              <CalendarDays size={15} />
              <input
                type="date"
                value={filters.issued}
                onChange={(event) => updateFilter('issued', event.target.value)}
              />
            </div>
          </label>
          <button className="filter-button" type="button" onClick={() => setFilters({ search: '', category: '', issued: '' })}>
            <Filter size={15} />
            Reset Filters
          </button>
          <button
            className="add-patient-button"
            type="button"
            onClick={() => {
              setMedicineForEdit(null)
              setShowAddMedicine(true)
            }}
          >
            <PackagePlus size={15} />
            Add Medicine
          </button>
        </aside>

        <article className="cho-patient-list-panel cho-inventory-panel">
          <h2>Medicine Available</h2>
          {errorMessage && (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              {errorMessage}
            </div>
          )}
          {filteredMedicines.length > 0 ? (
            <div className="cho-medicine-request-table-wrap">
              <table className="cho-medicine-request-table cho-inventory-table">
                <thead>
                  <tr>
                    <th>Medicine ID</th>
                    <th>Category</th>
                    <th>Name</th>
                    <th>Type / Dosage</th>
                    <th>Issued</th>
                    <th>Expiry</th>
                    <th>Stocks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((medicine) => (
                    <tr key={medicine.id}>
                      <td><strong>{medicine.id}</strong></td>
                      <td>{medicine.category}</td>
                      <td><strong>{medicine.name}</strong></td>
                      <td>
                        <strong>{medicine.type}</strong>
                        <span>{medicine.dosage}</span>
                      </td>
                      <td>{medicine.issued}</td>
                      <td>{medicine.expiry}</td>
                      <td>{medicine.stocks}</td>
                      <td>
                        <div className="cho-request-actions">
                          <button className="request-view-button" type="button" onClick={() => openEditMedicine(medicine)}>
                            <Edit size={13} />
                            Edit
                          </button>
                          <button className="request-dispatch-button" type="button" onClick={onDistribute}>
                            <Send size={13} />
                            Distribute
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              No medicine found.
            </div>
          )}
        </article>
      </section>

      {showAddMedicine && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal medicine-modal" aria-label="Medicine form">
            <header>
              <h2>{medicineForEdit ? 'Edit Medicine' : 'Add Medicine'}</h2>
              <button type="button" aria-label="Close medicine form" onClick={closeMedicineForm}>
                <X size={18} />
              </button>
            </header>

            <form className="medicine-form" onSubmit={handleSaveMedicine}>
              <InventoryMedicineFields key={medicineForEdit?.id || 'new'} medicine={medicineForEdit} />
              <label>
                <span>Stocks</span>
                <input name="stocks" type="number" min="0" defaultValue={medicineForEdit?.stocks || ''} required />
              </label>
              <label>
                <span>Issued</span>
                <input name="issued" type="date" defaultValue={medicineForEdit?.issued || ''} required />
              </label>
              <label>
                <span>Expiry</span>
                <input name="expiry" type="date" defaultValue={medicineForEdit?.expiry || ''} required />
              </label>

              <div className="medicine-form-actions">
                <button type="button" onClick={closeMedicineForm}>
                  <ArrowLeft size={15} />
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}>
                  <Check size={15} />
                  {isSaving ? 'Saving...' : 'Save Medicine'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default CHOMedicineDistribution
