import { getApiErrorMessage } from '../../../services/apiErrors'
import { compareMedicineInventory } from '../../../services/medicines'
import catalog from '../../../../../backend/core/medicine_catalog.json'
import BHCFilterToolbar from './BHCFilterToolbar'
import InventoryMedicineFields from '../shared/InventoryMedicineFields'
import MedicineRequestCart from './MedicineRequestCart'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CalendarDays, Check, Edit, Filter, Link, PackagePlus, Send, X } from 'lucide-react'
import { createMedicineRequest, fetchMedicineInventory, fetchMedicineRequestsForBhc, saveMedicineInventory } from '../../../services/medicines'
import './BHCInventoryMatch.css'



const LOW_STOCK_THRESHOLD = 20
const MAX_REQUEST_QUANTITY = 1000
const getTodayDate = () => new Date().toISOString().slice(0, 10)

const getRequestErrorMessage = (error) => getApiErrorMessage(error, 'Unable to submit medicine request.')

function BHCMedicineInventory({ onRequestSubmit, currentUserName = 'BHC Staff' }) {
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [medicineForRequest, setMedicineForRequest] = useState(null)
  const [medicineForEdit, setMedicineForEdit] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [filters, setFilters] = useState({ search: '', category: '', issued: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [requestCart, setRequestCart] = useState([])
  const [checkedMedicineIds, setCheckedMedicineIds] = useState([])
  const [showRequestCart, setShowRequestCart] = useState(false)
  const [stockFilter, setStockFilter] = useState('all')
  const [pendingMedicineIds, setPendingMedicineIds] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadInventory = async () => {
      try {
        const backendMedicines = await fetchMedicineInventory()
        if (isMounted) {
          setMedicines(backendMedicines)
          setErrorMessage('')
        }
        try {
          const requests = await fetchMedicineRequestsForBhc()
          if (!isMounted) return
          const pendingIds = new Set(requests.filter((request) => ['requested', 'approved', 'dispatched'].includes(request.rawStatus)).map((request) => request.medicineId))
          setPendingMedicineIds(pendingIds)
          setRequestCart((current) => [...new Map([...backendMedicines
            .filter((medicine) => medicine.stocks < LOW_STOCK_THRESHOLD && !pendingIds.has(medicine.medicineId))
            .map((medicine) => [medicine.medicineId, { ...medicine, quantity: LOW_STOCK_THRESHOLD - medicine.stocks }]), ...current.map((item) => [item.medicineId, item])]).values()])
        } catch {
          if (isMounted) setErrorMessage('Inventory loaded, but existing requests could not be checked. Automatic cart selection is paused; you can still select medicines manually.')
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Unable to load medicine inventory from the backend.')
        }
      }
    }

    loadInventory()

    return () => {
      isMounted = false
    }
  }, [])


  const filteredMedicines = useMemo(() => {
    return [...medicines].sort(compareMedicineInventory).filter((medicine) => {
      const matchesSearch =
        medicine.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        medicine.type.toLowerCase().includes(filters.search.toLowerCase()) ||
        medicine.category.toLowerCase().includes(filters.search.toLowerCase())

      const matchesCategory = !filters.category || medicine.category === filters.category
      const matchesIssued = !filters.issued || medicine.issued === filters.issued

      const matchesStock = stockFilter === 'all' || (stockFilter === 'low' ? medicine.stocks < LOW_STOCK_THRESHOLD : medicine.stocks >= LOW_STOCK_THRESHOLD)
      return matchesSearch && matchesCategory && matchesIssued && matchesStock
    })
  }, [filters, medicines, stockFilter])

  const categories = [...new Set([...catalog.map((item) => item.category), ...medicines.map((medicine) => medicine.category)])]
  const isSelected = (medicine) => checkedMedicineIds.includes(medicine.medicineId)
  const allVisibleSelected = filteredMedicines.length > 0 && filteredMedicines.every(isSelected)
  const toggleMedicine = (medicine) => {
    const wasChecked = isSelected(medicine)
    setCheckedMedicineIds((ids) => wasChecked ? ids.filter((id) => id !== medicine.medicineId) : [...ids, medicine.medicineId])
    setRequestCart((items) => wasChecked
      ? items.filter((item) => item.medicineId !== medicine.medicineId)
      : items.some((item) => item.medicineId === medicine.medicineId) ? items : [...items, { ...medicine, quantity: 1 }])
  }
  const toggleVisible = () => {
    setCheckedMedicineIds((ids) => allVisibleSelected
      ? ids.filter((id) => !filteredMedicines.some((medicine) => medicine.medicineId === id))
      : [...new Set([...ids, ...filteredMedicines.map((medicine) => medicine.medicineId)])])
    setRequestCart((items) => {
      if (allVisibleSelected) return items.filter((item) => !filteredMedicines.some((medicine) => medicine.medicineId === item.medicineId))
      const selected = new Map(items.map((item) => [item.medicineId, item]))
      filteredMedicines.forEach((medicine) => {
        if (!selected.has(medicine.medicineId)) selected.set(medicine.medicineId, { ...medicine, quantity: 1 })
      })
      return [...selected.values()]
    })
  }

  const handleFilterChange = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  const closeMedicineForm = () => {
    setShowAddMedicine(false)
    setMedicineForEdit(null)
  }

  const handleAddMedicine = async (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    if (!formData.get('name')) { setErrorMessage('Select a medicine from the predefined list.'); return }
    const medicinePayload = {
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
      const savedMedicine = await saveMedicineInventory(medicinePayload)
      setRequestCart((items) => {
        if (items.some((item) => item.medicineId === savedMedicine.medicineId)) {
          return items.map((item) => item.medicineId === savedMedicine.medicineId ? { ...savedMedicine, quantity: item.quantity } : item)
        }
        const becameLow = !medicineForEdit || medicineForEdit.stocks >= LOW_STOCK_THRESHOLD
        if (becameLow && savedMedicine.stocks < LOW_STOCK_THRESHOLD && pendingMedicineIds && !pendingMedicineIds.has(savedMedicine.medicineId)) {
          return [...items, { ...savedMedicine, quantity: LOW_STOCK_THRESHOLD - savedMedicine.stocks }]
        }
        return items
      })
      setMedicines((currentMedicines) => {
        const exists = currentMedicines.some((medicine) => medicine.backendId === savedMedicine.backendId)
        if (!exists) return [savedMedicine, ...currentMedicines]
        return currentMedicines.map((medicine) =>
          medicine.backendId === savedMedicine.backendId ? savedMedicine : medicine,
        )
      })
      closeMedicineForm()
      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to save medicine inventory.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmitRequest = async (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const quantity = Number(formData.get('quantity') || 0)

    if (quantity > MAX_REQUEST_QUANTITY) {
      setErrorMessage(`Medicine request quantity cannot exceed ${MAX_REQUEST_QUANTITY}.`)
      return
    }

    let createdRequest

    try {
      setIsSaving(true)
      createdRequest = await createMedicineRequest({
        medicineId: medicineForRequest.medicineId,
        medicineName: formData.get('medicineName'),
        quantity,
      })
      setErrorMessage('')
    } catch (requestError) {
      setErrorMessage(getRequestErrorMessage(requestError))
      return
    } finally {
      setIsSaving(false)
    }

    onRequestSubmit?.(createdRequest)
    setMedicineForRequest(null)
  }

  return (
    <div className="bhc-inventory-ui pharma-inventory-ui">
      <div className="bhc-page-heading">
        <div>
          <span>Medicine</span>
          <h1>Medicine Inventory</h1>
          <p>Pharmaceutical stock management.</p>
        </div>
      </div>

      {errorMessage && (
        <div className="patient-alert">
          <AlertTriangle size={16} />
          {errorMessage}
        </div>
      )}

      <section className="bhc-patient-page bhc-medicine-page cho-inventory-page">
        <BHCFilterToolbar placeholder="Search medicine..." value={filters.search} onSearch={(value) => handleFilterChange('search', value)}
          active={filters.category || filters.issued || stockFilter !== 'all'} actions={<button
            className="add-patient-button"
            type="button"
            onClick={() => {
              setMedicineForEdit(null)
              setShowAddMedicine(true)
            }}
          >
            <PackagePlus size={15} />
            Add Medicine
          </button>}>
          <label>
            <span>Category</span>
            <select value={filters.category} onChange={(event) => handleFilterChange('category', event.target.value)}>
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
                onChange={(event) => handleFilterChange('issued', event.target.value)}
              />
            </div>
          </label>
          <button className="filter-button" type="button" onClick={() => { setFilters({ search: '', category: '', issued: '' }); setStockFilter('all') }}>
            <Filter size={15} />
            Reset Filters
          </button>
        </BHCFilterToolbar>

        <article className="bhc-patient-list-panel bhc-medicine-list-panel cho-inventory-panel">
          <h2>Medicine Available</h2>
          <div className="medicine-stock-filters" role="group" aria-label="Filter by stock level">
            {[['all', 'All Medicines', medicines.length], ['low', 'Low Stock', medicines.filter((medicine) => medicine.stocks < LOW_STOCK_THRESHOLD).length], ['stocked', 'In Stock', medicines.filter((medicine) => medicine.stocks >= LOW_STOCK_THRESHOLD).length]].map(([value, label, count]) => <button key={value} type="button" aria-pressed={stockFilter === value} onClick={() => setStockFilter(value)}>{label} <span>{count}</span></button>)}
          </div>
          <div className="medicine-cart-toolbar">
            <span>Low-stock medicines are added to the cart without checking the list. Check medicines to add them manually, or review the cart to adjust or remove items. {requestCart.length > 0 && <strong>{requestCart.length} in cart</strong>}</span>
            <div>{requestCart.length > 0 && <button type="button" onClick={() => { setRequestCart([]); setCheckedMedicineIds([]) }}>Clear cart</button>}<button type="button" className="medicine-cart-review" disabled={!requestCart.length} onClick={() => setShowRequestCart(true)}>Review Request Cart ({requestCart.length})</button></div>
          </div>

          {filteredMedicines.length > 0 ? (
            <div className="bhc-patient-table-wrap cho-medicine-request-table-wrap">
              <table className="bhc-patient-table bhc-medicine-table cho-inventory-table">
                <thead>
                  <tr>
                    <th className="medicine-selection-cell"><input type="checkbox" aria-label="Select all filtered medicines" checked={allVisibleSelected} ref={(node) => { if (node) node.indeterminate = !allVisibleSelected && filteredMedicines.some(isSelected) }} onChange={toggleVisible} /></th>
                    <th>Medicine ID</th>
                    <th>Category</th>
                    <th>Name</th>
                    <th>Type / Dosage</th>
                    <th>Issued</th>
                    <th>Expiry</th>
                    <th>Stocks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((medicine) => {
                    const isLowStock = Number(medicine.stocks) < LOW_STOCK_THRESHOLD

                    return (
                      <tr key={medicine.id} className={isSelected(medicine) ? 'medicine-cart-selected' : ''}>
                        <td className="medicine-selection-cell"><input type="checkbox" aria-label={`Select ${medicine.name} ${medicine.type} ${medicine.dosage}`} checked={isSelected(medicine)} onChange={() => toggleMedicine(medicine)} /></td>
                        <td><strong>{medicine.id}</strong></td>
                        <td>{medicine.category}</td>
                        <td><strong>{medicine.name}</strong></td>
                        <td><strong>{medicine.type}</strong><span>{medicine.dosage}</span></td>
                        <td>{medicine.issued}</td>
                        <td>{medicine.expiry}</td>
                        <td><div className="bhc-stock-indicator"><strong>{medicine.stocks}</strong>
                          <span className={`medicine-status ${isLowStock ? 'low' : 'stocked'}`}>
                            {isLowStock ? 'Low Stock' : 'In Stock'}
                          </span>
                          </div>
                        </td>
                        <td>
                          <div className="medicine-row-actions cho-request-actions">
                            {isLowStock && (
                              <button className="medicine-request-button" type="button" onClick={() => setMedicineForRequest(medicine)}>
                                <Send size={13} />
                                Request
                              </button>
                            )}
                            <button
                              className="medicine-edit-button"
                              type="button"
                              onClick={() => {
                                setMedicineForEdit(medicine)
                                setShowAddMedicine(true)
                              }}
                            >
                              <Edit size={13} />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="patient-alert">
              <AlertTriangle size={16} />
              No medicine found!
            </div>
          )}
        </article>
      </section>

      {showAddMedicine && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal medicine-modal" aria-label="Add new medicine form">
            <header>
              <h2>{medicineForEdit ? 'Edit Medicine' : 'Add New Medicine'}</h2>
              <button type="button" aria-label="Close add medicine form" onClick={closeMedicineForm}>
                <X size={18} />
              </button>
            </header>

            <form className="medicine-form" onSubmit={handleAddMedicine}>
              <InventoryMedicineFields key={medicineForEdit?.id || 'new'} medicine={medicineForEdit} />
              <label>
                <span>Stocks</span>
                <input name="stocks" type="number" min="0" defaultValue={medicineForEdit?.stocks || ''} placeholder="0" />
              </label>
              <label>
                <span>Issued</span>
                <input name="issued" type="date" defaultValue={medicineForEdit?.issued || getTodayDate()} required />
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

      {showRequestCart && <MedicineRequestCart items={requestCart} onChange={(items) => {
        setRequestCart(items)
        setCheckedMedicineIds((ids) => ids.filter((id) => items.some((item) => item.medicineId === id)))
      }} onClose={() => setShowRequestCart(false)} onSubmitted={(requests) => {
        setRequestCart([])
        setCheckedMedicineIds([])
        setShowRequestCart(false)
        requests.forEach((request) => onRequestSubmit?.(request))
      }} />}

      {medicineForRequest && (
        <div className="patient-modal-backdrop" role="presentation">
          <section className="patient-modal medicine-request-modal" aria-label="Medicine request form">
            <header>
              <div>
                <h2>Medicine Request Form</h2>
                <p>Fill out the information to create a new request.</p>
              </div>
              <button type="button" aria-label="Close medicine request form" onClick={() => setMedicineForRequest(null)}>
                <X size={18} />
              </button>
            </header>

            <form className="medicine-request-form" onSubmit={handleSubmitRequest}>
              <label className="full">
                <span>Medicine Name *</span>
                <input name="medicineName" type="text" defaultValue={medicineForRequest.name} placeholder="e.g., Paracetamol" required />
              </label>
              <label>
                <span>Requested From *</span>
                <select name="requestedFrom" defaultValue="City Health Office" required>
                  <option>City Health Office of Lucena</option>
                </select>
              </label>
              <label>
                <span>Date Requested *</span>
                <input name="dateRequested" type="date" defaultValue={getTodayDate()} required />
              </label>
              <label>
                <span>Quantity Required *</span>
                <input name="quantity" type="number" min="1" max={MAX_REQUEST_QUANTITY} placeholder="Enter quantity" required />
              </label>
              <label className="full">
                <span>Requested by Address *</span>
                <input name="address" type="text" defaultValue={medicineForRequest.facility || 'Assigned barangay'} required />
                <small>Medicine requests are filed under the barangay assigned to your logged-in account.</small>
              </label>
              <label className="full">
                <span>Pick Up By *</span>
                <input name="pickUpBy" type="text" defaultValue={currentUserName} required />
              </label>

              <div className="medicine-form-actions">
                <button type="button" onClick={() => setMedicineForRequest(null)}>
                  <ArrowLeft size={15} />
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}>
                  <Link size={15} />
                  {isSaving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default BHCMedicineInventory


