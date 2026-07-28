'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Header from '@/app/components/Header'
import { useToast } from '@/app/components/Toast'
import ScannerCodeBarre from '@/app/components/ScannerCodeBarre'
import { SkeletonRepas } from '@/app/components/Skeleton'
import Link from 'next/link'
import { ErreurChargement } from '@/app/components/Erreur'

const TYPES = [
  { value: 'petit-dejeuner', label: 'Petit-déjeuner', icon: '🍳' },
  { value: 'dejeuner', label: 'Déjeuner', icon: '🥗' },
  { value: 'diner', label: 'Dîner', icon: '🍝' },
  { value: 'collation', label: 'Collation', icon: '🍎' },
]

const OBJECTIF_LABELS = {
  perte_poids: { label: 'Perte de poids', color: '#3B82F6', bg: '#EFF6FF', icon: '📉' },
  maintien: { label: 'Maintien', color: '#22c55e', bg: '#F0FDF4', icon: '⚖️' },
  prise_masse: { label: 'Prise de masse', color: '#FF5722', bg: '#FFF3F0', icon: '💪' },
  tous: { label: 'Tous objectifs', color: '#6B7280', bg: '#F9FAFB', icon: '✓' },
}

function aujourdHui() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function Repas() {
  const supabase = createClient()
  const toast = useToast()
  const [erreur, setErreur] = useState(null)

  const [userId, setUserId] = useState(null)
  const [repas, setRepas] = useState([])
  const [loading, setLoading] = useState(true)
  const [repasEnEdition, setRepasEnEdition] = useState(null)
  const [dateSelectionnee, setDateSelectionnee] = useState(aujourdHui())

  // Onglet actif : 'repas-types' ou 'frigo'
  const [onglet, setOnglet] = useState('repas-types')

  // Catalogue
  const [type, setType] = useState('petit-dejeuner')
  const [optionsParType, setOptionsParType] = useState({})
  const [ingredientsParOption, setIngredientsParOption] = useState({})
  const [optionOuverte, setOptionOuverte] = useState(null)
  const [modeLibre, setModeLibre] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // Saisie libre
  const [nom, setNom] = useState('')
  const [kcalLibre, setKcalLibre] = useState('')
  const [proteinesLibre, setProteinesLibre] = useState('')
  const [glucidesLibre, setGlucidesLibre] = useState('')
  const [lipidesLibre, setLipidesLibre] = useState('')
  const [quantiteG, setQuantiteG] = useState('')

  // Suggestions IA frigo
  const [ingredients, setIngredients] = useState('')
  const [suggestionsIA, setSuggestionsIA] = useState([])
  const [loadingIA, setLoadingIA] = useState(false)
  const [erreurIA, setErreurIA] = useState(null)
  const [typeRepasIA, setTypeRepasIA] = useState('dejeuner')

  // Liste de courses
  const [listeCourses, setListeCourses] = useState(null)
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [erreurCourses, setErreurCourses] = useState(null)
  const [articlesCoches, setArticlesCoches] = useState({})
  const [coursesGenerees, setCoursesGenerees] = useState(false)
  const [suggestions, setSuggestions] = useState([]) // options filtrées par objectif
  const [typeSuggestion, setTypeSuggestion] = useState('petit-dejeuner')
  const [caloriesRestantes, setCaloriesRestantes] = useState(null)
  const [suggestionOuverte, setSuggestionOuverte] = useState(null)
  const [profil, setProfil] = useState(null)

  useEffect(() => { charger() }, [dateSelectionnee])

  async function charger() {
    setLoading(true)
    setErreur(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Repas de la date sélectionnée
      const { data } = await supabase.from('repas')
        .select('*, options_repas(kcal, proteines_g, glucides_g, lipides_g)')
        .eq('user_id', user.id).eq('date_repas', dateSelectionnee).order('created_at')
      setRepas(data || [])

      // Catalogue complet
      const { data: options } = await supabase.from('options_repas').select('*').order('objectif_cible').order('ordre')
      const groupes = {}
      options?.forEach((o) => { if (!groupes[o.type]) groupes[o.type] = []; groupes[o.type].push(o) })
      setOptionsParType(groupes)

      if (options?.length > 0) {
        const { data: ingredients } = await supabase.from('options_repas_ingredients').select('*').order('ordre')
        const groupesIng = {}
        ingredients?.forEach((i) => { if (!groupesIng[i.option_repas_id]) groupesIng[i.option_repas_id] = []; groupesIng[i.option_repas_id].push(i) })
        setIngredientsParOption(groupesIng)
      }

      // Profil utilisateur pour les suggestions
      const { data: profilData } = await supabase.from('profil').select('*').eq('user_id', user.id).single()
      const { data: mesures } = await supabase.from('mesures').select('poids_kg,taille_cm')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)

      if (profilData && mesures?.[0]) {
        const p = { ...profilData, ...mesures[0] }
        setProfil(p)
        const { calculerCaloriesCible } = await import('@/lib/calculs')
        const { caloriesCible } = calculerCaloriesCible({
          poids: mesures[0].poids_kg, taille: mesures[0].taille_cm,
          age: profilData.age, sexe: profilData.sexe,
          niveauActivite: profilData.niveau_activite, objectif: profilData.objectif,
        })
        const caloConso = (data || []).reduce((a, r) => {
          const ratio = r.quantite_g ? r.quantite_g / 100 : 1
          const kcal = r.options_repas ? (r.options_repas.kcal || 0) * ratio : (r.kcal_libre || 0)
          return a + kcal
        }, 0)
        setCaloriesRestantes(caloriesCible - caloConso)
        const filtrees = (options || []).filter(o =>
          o.objectif_cible === profilData.objectif || o.objectif_cible === 'tous'
        )
        setSuggestions(filtrees)
      } else {
        setSuggestions(options || [])
      }
    } catch (e) {
      setErreur(e.message === 'timeout'
        ? 'Connexion trop lente. Supabase est peut-être indisponible.'
        : 'Impossible de charger les repas. Vérifie ta connexion.')
    } finally {
      setLoading(false)
    }
  }

  async function genererListeCourses() {
    setLoadingCourses(true)
    setErreurCourses(null)
    setListeCourses(null)
    setArticlesCoches({})

    try {
      // Charger les repas des 4 dernières semaines
      const il_y_a_28j = new Date()
      il_y_a_28j.setDate(il_y_a_28j.getDate() - 28)
      const { data: repasHistorique } = await supabase
        .from('repas')
        .select('nom, type, kcal_libre, proteines_libre, glucides_libre, lipides_libre')
        .eq('user_id', userId)
        .gte('date_repas', il_y_a_28j.toISOString().split('T')[0])

      // Calculer les calories cibles depuis le profil
      let caloriesCible = null
      if (profil) {
        const { calculerCaloriesCible } = await import('@/lib/calculs')
        const res = calculerCaloriesCible({
          poids: profil.poids_kg, taille: profil.taille_cm,
          age: profil.age, sexe: profil.sexe,
          niveauActivite: profil.niveauActivite, objectif: profil.objectif
        })
        caloriesCible = res?.caloriesCible || null
      }

      const res = await fetch('/api/ia/liste-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repas: repasHistorique || [],
          profil,
          caloriesCible,
        }),
      })

      if (!res.ok) throw new Error('Erreur serveur')
      const data = await res.json()
      setListeCourses(data.liste)
      setCoursesGenerees(true)
    } catch {
      setErreurCourses('Impossible de générer la liste. Réessaie.')
    } finally {
      setLoadingCourses(false)
    }
  }

  function toggleArticle(categorieNom, articleNom) {
    const key = `${categorieNom}__${articleNom}`
    setArticlesCoches(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function sauvegarderCommeRepasType(suggestion) {
    if (!userId) return
    try {
      const { data, error } = await supabase.from('options_repas').insert([{
        user_id: userId,
        nom: suggestion.nom,
        type: typeRepasIA,
        kcal: suggestion.kcal,
        proteines_g: suggestion.proteines,
        glucides_g: suggestion.glucides,
        lipides_g: suggestion.lipides,
        note_preparation: suggestion.etapes?.join('\n') || null,
        objectif_cible: profil?.objectif || 'tous',
        ordre: 0,
      }]).select()

      if (error) throw error

      // Insérer les ingrédients avec l'id retourné
      const newId = data?.[0]?.id
      if (newId && suggestion.ingredients_utilises?.length) {
        const ings = suggestion.ingredients_utilises.map((ing, i) => ({
          option_repas_id: newId,
          nom: typeof ing === 'string' ? ing : ing.nom,
          quantite: typeof ing === 'string' ? null : ing.quantite,
          ordre: i,
        }))
        await supabase.from('options_repas_ingredients').insert(ings)
      }

      toast(`"${suggestion.nom}" ajouté à tes repas types ✓`)
      // Recharger le catalogue pour afficher le nouveau repas type
      charger()
    } catch (e) {
      console.error('sauvegarderCommeRepasType:', e)
      toast('Erreur lors de la sauvegarde')
    }
  }

  async function supprimerRepasType(id) {
    if (!confirm('Supprimer ce repas type ?')) return
    await supabase.from('options_repas').delete().eq('id', id).eq('user_id', userId)
    charger()
  }

  async function suggererAvecIA() {
    if (!ingredients.trim()) return
    setLoadingIA(true)
    setErreurIA(null)
    setSuggestionsIA([])

    const objectifLabel = {
      perte_poids: 'perte de poids (déficit calorique, privilégier les protéines et légumes)',
      maintien: 'maintien du poids (équilibre macros)',
      prise_masse: 'prise de masse (surplus calorique, beaucoup de protéines et glucides)',
    }[profil?.objectif] || 'équilibre alimentaire'

    const typeLabel = TYPES.find(t => t.value === typeRepasIA)?.label || typeRepasIA

    try {
      const res = await fetch('/api/ia/suggestions-repas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          objectifLabel,
          typeLabel,
          caloriesRestantes,
          profil: profil ? { sexe: profil.sexe, age: profil.age, objectif: profil.objectif } : null,
        }),
      })
      if (!res.ok) throw new Error('Erreur serveur')
      const data = await res.json()
      setSuggestionsIA(data.suggestions || [])
    } catch {
      setErreurIA('Impossible de générer des suggestions. Réessaie.')
    } finally {
      setLoadingIA(false)
    }
  }

  async function ajouterSuggestionIA(suggestion) {
    if (!userId) return
    await supabase.from('repas').insert([{
      user_id: userId,
      nom: suggestion.nom,
      type: typeRepasIA,
      date_repas: dateSelectionnee,
      kcal_libre: suggestion.kcal,
      proteines_libre: suggestion.proteines,
      glucides_libre: suggestion.glucides,
      lipides_libre: suggestion.lipides,
    }])
    toast(`${suggestion.nom} ajouté ✓`)
    charger()
  }

  async function choisirOption(option) {
    if (!userId) return
    await supabase.from('repas').insert([{
      user_id: userId, nom: option.nom, type: option.type,
      date_repas: dateSelectionnee, option_repas_id: option.id,
    }])
    setOptionOuverte(null)
    setSuggestionOuverte(null)
    toast(`${option.nom} ajouté ✓`)
    charger()
  }

  async function ajouterRepasLibre(e) {
    e.preventDefault()
    if (!nom.trim() || !userId) return
    const ratio = kcalLibre && quantiteG ? Number(quantiteG) / 100 : 1
    await supabase.from('repas').insert([{
      user_id: userId, nom, type,
      date_repas: dateSelectionnee,
      kcal_libre: kcalLibre ? Math.round(Number(kcalLibre) * ratio) : null,
      proteines_libre: proteinesLibre ? Math.round(Number(proteinesLibre) * ratio * 10) / 10 : null,
      glucides_libre: glucidesLibre ? Math.round(Number(glucidesLibre) * ratio * 10) / 10 : null,
      lipides_libre: lipidesLibre ? Math.round(Number(lipidesLibre) * ratio * 10) / 10 : null,
      quantite_g: quantiteG ? Number(quantiteG) : null,
    }])
    setNom(''); setKcalLibre(''); setProteinesLibre(''); setGlucidesLibre(''); setLipidesLibre(''); setQuantiteG('')
    toast('Repas ajouté ✓')
    charger()
  }

  function onResultatScan({ nom: nomProduit, kcal, proteines, glucides, lipides }) {
    setShowScanner(false)
    setModeLibre(true)
    setNom(kcal ? `${nomProduit} (100g)` : nomProduit)
    if (kcal) { setKcalLibre(String(kcal)); setQuantiteG('100') }
    if (proteines) setProteinesLibre(String(proteines))
    if (glucides) setGlucidesLibre(String(glucides))
    if (lipides) setLipidesLibre(String(lipides))
    toast(`Produit trouvé : ${nomProduit} 📦`)
  }

  async function modifierRepas(id, champs) {
    const { error } = await supabase.from('repas').update(champs).eq('id', id)
    if (error) { toast('Erreur lors de la modification', 'error'); return }
    toast('Repas modifié ✓')
    setRepasEnEdition(null)
    charger()
  }

  async function supprimer(id) {
    if (!confirm('Supprimer ce repas ?')) return
    await supabase.from('repas').delete().eq('id', id)
    toast('Repas supprimé')
    charger()
  }

  const optionsDuType = (optionsParType[type] || []).filter(o => o.objectif_cible === 'tous')
  const suggestionsDuType = suggestions.filter(s => s.type === typeSuggestion)

  // Totaux macros du jour
  const totaux = repas.reduce((acc, r) => {
    const ratio = r.quantite_g ? r.quantite_g / 100 : 1
    const kcal = r.options_repas ? (r.options_repas.kcal || 0) * ratio : (r.kcal_libre || 0)
    const p = r.options_repas ? (r.options_repas.proteines_g || 0) * ratio : (r.proteines_libre || 0)
    const g = r.options_repas ? (r.options_repas.glucides_g || 0) * ratio : (r.glucides_libre || 0)
    const l = r.options_repas ? (r.options_repas.lipides_g || 0) * ratio : (r.lipides_libre || 0)
    return { kcal: acc.kcal + kcal, p: acc.p + p, g: acc.g + g, l: acc.l + l }
  }, { kcal: 0, p: 0, g: 0, l: 0 })

  return (
    <div>
      {showScanner && <ScannerCodeBarre onResultat={onResultatScan} onFermer={() => setShowScanner(false)} />}

      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {dateSelectionnee === aujourdHui() ? 'Repas du jour' : 'Repas'}
          </p>
          <p className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>
            {new Date(dateSelectionnee + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link href="/nutrition"
          className="text-xs px-3 py-1.5 rounded-full mt-1 font-medium"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          📊 Historique
        </Link>
      </div>

      {/* Sélecteur de date */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => {
          const d = new Date(dateSelectionnee + 'T12:00:00')
          d.setDate(d.getDate() - 1)
          setDateSelectionnee(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
        }} className="px-3 py-1.5 rounded-xl text-sm"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>←</button>

        <input type="date" value={dateSelectionnee}
          max={aujourdHui()}
          onChange={e => setDateSelectionnee(e.target.value)}
          className="flex-1 input text-sm text-center" />

        <button onClick={() => {
          const d = new Date(dateSelectionnee + 'T12:00:00')
          d.setDate(d.getDate() + 1)
          const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          if (next <= aujourdHui()) setDateSelectionnee(next)
        }} className="px-3 py-1.5 rounded-xl text-sm"
          style={{
            background: 'var(--surface-2)',
            color: dateSelectionnee === aujourdHui() ? 'var(--text-faint)' : 'var(--text)',
            opacity: dateSelectionnee === aujourdHui() ? 0.4 : 1,
          }}>→</button>

        {dateSelectionnee !== aujourdHui() && (
          <button onClick={() => setDateSelectionnee(aujourdHui())}
            className="text-xs px-2 py-1.5 rounded-xl"
            style={{ background: 'var(--orange)', color: 'white' }}>
            Aujourd'hui
          </button>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'repas-types', label: '📋 Repas types' },
          { id: 'frigo', label: '🧊 Frigo IA' },
          { id: 'courses', label: '🛒 Courses' },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: onglet === o.id ? 'var(--orange)' : 'var(--surface)',
              color: onglet === o.id ? 'white' : 'var(--text-muted)',
              border: `1px solid ${onglet === o.id ? 'var(--orange)' : 'var(--border)'}`,
            }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* ======== ONGLET REPAS TYPES (fusion catalogue + suggestions) ======== */}
      {onglet === 'repas-types' && (
        <>
          {/* Info objectif + toggle tout afficher */}
          <div className="flex items-center justify-between mb-3">
            {profil ? (
              <div className="flex items-center gap-2">
                <span>{OBJECTIF_LABELS[profil.objectif]?.icon}</span>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {OBJECTIF_LABELS[profil.objectif]?.label}
                  {caloriesRestantes !== null && (
                    <span style={{ color: caloriesRestantes < 0 ? '#ef4444' : 'var(--orange)' }}>
                      {' · '}{caloriesRestantes > 0
                        ? `${Math.round(caloriesRestantes)} kcal restantes`
                        : `+${Math.abs(Math.round(caloriesRestantes))} kcal`}
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                Renseigne ton profil pour des suggestions personnalisées
              </p>
            )}
            {profil && (
              <button onClick={() => setModeLibre(v => !v)}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{
                  background: modeLibre ? 'var(--orange)' : 'var(--surface-2)',
                  color: modeLibre ? 'white' : 'var(--text-muted)',
                }}>
                {modeLibre ? '✓ Tous' : 'Tous'}
              </button>
            )}
          </div>

          {/* Filtre type de repas */}
          <div className="flex gap-2 flex-wrap mb-4">
            {TYPES.map((t) => (
              <button type="button" key={t.value} onClick={() => { setType(t.value); setOptionOuverte(null) }}
                className="px-3 py-1.5 rounded-full text-sm font-medium border"
                style={{
                  background: type === t.value ? 'var(--orange)' : 'var(--surface)',
                  color: type === t.value ? 'white' : 'var(--text-muted)',
                  borderColor: type === t.value ? 'var(--orange)' : 'var(--border)',
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Liste des repas types (filtrés par objectif sauf si modeLibre) */}
          {(() => {
            const optionsFiltrees = modeLibre
              ? (optionsParType[type] || [])
              : (optionsParType[type] || []).filter(o =>
                  !profil || o.objectif_cible === profil.objectif || o.objectif_cible === 'tous'
                )
            return optionsFiltrees.length > 0 ? (
              <div className="flex flex-col gap-3 mb-4">
                {optionsFiltrees.map((option) => (
                  <CarteOption key={option.id} option={option}
                    ingredients={ingredientsParOption[option.id] || []}
                    ouvert={optionOuverte === option.id}
                    onToggle={() => setOptionOuverte(optionOuverte === option.id ? null : option.id)}
                    onChoisir={() => choisirOption(option)}
                    caloriesRestantes={caloriesRestantes}
                    afficherObjectif={modeLibre}
                    onSupprimer={option.user_id ? () => supprimerRepasType(option.id) : null}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-sm mb-4" style={{ color: 'var(--text-faint)' }}>
                Aucun repas type pour ce créneau.
              </p>
            )
          })()}

          {/* Saisie libre */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
              SAISIE LIBRE / SCAN
            </p>
            <FormulaireSaisieLibre
              nom={nom} setNom={setNom}
              kcalLibre={kcalLibre} setKcalLibre={setKcalLibre}
              proteinesLibre={proteinesLibre} setProteinesLibre={setProteinesLibre}
              glucidesLibre={glucidesLibre} setGlucidesLibre={setGlucidesLibre}
              lipidesLibre={lipidesLibre} setLipidesLibre={setLipidesLibre}
              quantiteG={quantiteG} setQuantiteG={setQuantiteG}
              onSubmit={ajouterRepasLibre}
              onScanner={() => setShowScanner(true)}
              onAnnuler={null}
            />
          </div>
        </>
      )}

      {/* ======== ONGLET FRIGO IA ======== */}
      {onglet === 'frigo' && (
        <div className="flex flex-col gap-4">

          {/* Contexte objectif */}
          {caloriesRestantes !== null && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ background: 'var(--surface-2)' }}>
              <span>{OBJECTIF_LABELS[profil?.objectif]?.icon || '🎯'}</span>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {OBJECTIF_LABELS[profil?.objectif]?.label} ·{' '}
                <span style={{ color: caloriesRestantes < 0 ? '#ef4444' : 'var(--orange)' }}>
                  {caloriesRestantes > 0
                    ? `${Math.round(caloriesRestantes)} kcal restantes`
                    : `${Math.abs(Math.round(caloriesRestantes))} kcal au-dessus`}
                </span>
              </p>
            </div>
          )}

          {/* Sélecteur type de repas */}
          <div>
            <p className="label mb-2">Type de repas</p>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map(t => (
                <button key={t.value} onClick={() => setTypeRepasIA(t.value)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border"
                  style={{
                    background: typeRepasIA === t.value ? 'var(--orange)' : 'var(--surface)',
                    color: typeRepasIA === t.value ? 'white' : 'var(--text-muted)',
                    borderColor: typeRepasIA === t.value ? 'var(--orange)' : 'var(--border)',
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Champ ingrédients */}
          <div>
            <label className="label">Qu'est-ce que tu as dans ton frigo ?</label>
            <textarea
              value={ingredients}
              onChange={e => setIngredients(e.target.value)}
              placeholder="Ex: œufs, poulet, riz, tomates, fromage, épinards..."
              rows={3}
              className="input resize-none text-sm w-full"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
              Tu peux supposer sel, poivre, huile, ail, oignon disponibles.
            </p>
          </div>

          {/* Bouton générer */}
          <button
            onClick={suggererAvecIA}
            disabled={!ingredients.trim() || loadingIA}
            className="btn-primary py-3 font-semibold disabled:opacity-40">
            {loadingIA ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Génération en cours...
              </span>
            ) : '🤖 Générer des suggestions'}
          </button>

          {/* Erreur */}
          {erreurIA && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>{erreurIA}</p>
          )}

          {/* Suggestions générées */}
          {suggestionsIA.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                3 SUGGESTIONS POUR TOI
              </p>
              {suggestionsIA.map((s, i) => (
                <div key={i} className="card flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{s.nom}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.description}</p>
                    </div>
                    {s.temps && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-faint)' }}>
                        ⏱ {s.temps}
                      </span>
                    )}
                  </div>

                  {/* Macros */}
                  <div className="flex gap-3">
                    {[
                      { label: 'kcal', val: s.kcal, color: 'var(--orange)' },
                      { label: 'Prot.', val: `${s.proteines}g`, color: 'var(--text)' },
                      { label: 'Gluc.', val: `${s.glucides}g`, color: 'var(--text)' },
                      { label: 'Lip.', val: `${s.lipides}g`, color: 'var(--text)' },
                    ].map(m => (
                      <div key={m.label} className="text-center">
                        <p className="text-sm font-bold" style={{ color: m.color }}>{m.val}</p>
                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Ingrédients avec quantités */}
                  {s.ingredients_utilises?.length > 0 && (
                    <div className="rounded-xl p-3 flex flex-col gap-1.5"
                      style={{ background: 'var(--surface-2)' }}>
                      <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
                        🧄 Ingrédients
                      </p>
                      {s.ingredients_utilises.map((ing, j) => {
                        // Supporter les deux formats : objet { nom, quantite } ou string
                        const nom = typeof ing === 'string' ? ing : ing.nom
                        const quantite = typeof ing === 'string' ? null : ing.quantite
                        return (
                          <div key={j} className="flex justify-between items-center">
                            <span className="text-xs" style={{ color: 'var(--text)' }}>{nom}</span>
                            {quantite && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--surface)', color: 'var(--orange)' }}>
                                {quantite}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Étapes */}
                  {s.etapes?.length > 0 && (
                    <div className="rounded-xl p-2.5 flex flex-col gap-1"
                      style={{ background: 'var(--surface-2)' }}>
                      {s.etapes.map((e, j) => (
                        <p key={j} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {j + 1}. {e}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Boutons */}
                  <div className="flex gap-2">
                    <button onClick={() => ajouterSuggestionIA(s)}
                      className="btn-primary text-sm py-2 flex-1">
                      + Ajouter à mes repas
                    </button>
                    <button onClick={() => sauvegarderCommeRepasType(s)}
                      className="text-sm py-2 px-3 rounded-xl font-medium flex-shrink-0"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                      title="Sauvegarder comme repas type">
                      💾
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======== ONGLET COURSES ======== */}
      {onglet === 'courses' && (
        <div className="flex flex-col gap-4">

          {/* Contexte */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              🛒 Liste de courses pour 7 jours
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
              Générée en analysant tes habitudes alimentaires des 4 dernières semaines
              {profil?.objectif ? ` · Objectif : ${
                profil.objectif === 'perte_poids' ? 'perte de poids' :
                profil.objectif === 'prise_masse' ? 'prise de masse' : 'maintien'
              }` : ''}
            </p>
          </div>

          {/* Bouton générer */}
          {!coursesGenerees && (
            <button onClick={genererListeCourses} disabled={loadingCourses}
              className="btn-primary py-3 font-semibold disabled:opacity-40">
              {loadingCourses ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Analyse en cours...
                </span>
              ) : '🤖 Générer ma liste de courses'}
            </button>
          )}

          {erreurCourses && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>{erreurCourses}</p>
          )}

          {/* Liste générée */}
          {listeCourses && (
            <div className="flex flex-col gap-4">

              {/* Conseil + budget */}
              {(listeCourses.conseil_semaine || listeCourses.budget_estime) && (
                <div className="rounded-xl px-3 py-2.5 flex flex-col gap-1"
                  style={{ background: 'var(--surface-2)', borderLeft: '3px solid var(--orange)' }}>
                  {listeCourses.conseil_semaine && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      💡 {listeCourses.conseil_semaine}
                    </p>
                  )}
                  {listeCourses.budget_estime && (
                    <p className="text-xs font-semibold" style={{ color: 'var(--orange)' }}>
                      Budget estimé : {listeCourses.budget_estime}
                    </p>
                  )}
                </div>
              )}

              {/* Progression cochés */}
              {(() => {
                const total = listeCourses.categories?.reduce((a, c) => a + c.articles.length, 0) || 0
                const coches = Object.values(articlesCoches).filter(Boolean).length
                return total > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(coches / total) * 100}%`, background: coches === total ? '#22c55e' : 'var(--orange)' }} />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {coches}/{total}
                    </span>
                  </div>
                )
              })()}

              {/* Catégories */}
              {listeCourses.categories?.map(categorie => {
                const cochesCategorie = categorie.articles.filter(a =>
                  articlesCoches[`${categorie.nom}__${a.nom}`]
                ).length
                return (
                  <div key={categorie.nom} className="card flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                        {categorie.emoji} {categorie.nom}
                      </p>
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {cochesCategorie}/{categorie.articles.length}
                      </span>
                    </div>
                    {categorie.articles.map(article => {
                      const key = `${categorie.nom}__${article.nom}`
                      const coche = articlesCoches[key]
                      return (
                        <button key={article.nom} onClick={() => toggleArticle(categorie.nom, article.nom)}
                          className="flex items-center gap-3 w-full text-left py-1">
                          <div className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                            style={{
                              borderColor: coche ? '#22c55e' : 'var(--border)',
                              background: coche ? '#22c55e' : 'transparent',
                            }}>
                            {coche && <span className="text-white text-xs">✓</span>}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm" style={{
                              color: coche ? 'var(--text-faint)' : 'var(--text)',
                              textDecoration: coche ? 'line-through' : 'none',
                            }}>
                              {article.nom}
                            </span>
                            {article.conseil && !coche && (
                              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{article.conseil}</p>
                            )}
                          </div>
                          <span className="text-xs font-medium flex-shrink-0"
                            style={{ color: coche ? 'var(--text-faint)' : 'var(--orange)' }}>
                            {article.quantite}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}

              {/* Regénérer */}
              <button onClick={() => { setCoursesGenerees(false); setListeCourses(null); setArticlesCoches({}) }}
                className="text-sm text-center underline" style={{ color: 'var(--text-faint)' }}>
                ↺ Regénérer la liste
              </button>
            </div>
          )}
        </div>
      )}

      {/* Totaux macros du jour */}
      {repas.length > 0 && totaux.kcal > 0 && (
        <div className="card mb-4 py-3">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Total du jour</p>
          <div className="flex justify-between">
            {[
              { label: 'kcal', val: Math.round(totaux.kcal), color: 'var(--orange)' },
              { label: 'Protéines', val: `${Math.round(totaux.p)}g`, color: 'var(--text)' },
              { label: 'Glucides', val: `${Math.round(totaux.g)}g`, color: 'var(--text)' },
              { label: 'Lipides', val: `${Math.round(totaux.l)}g`, color: 'var(--text)' },
            ].map(({ label, val, color }) => (
              <div key={label} className="text-center">
                <p className="text-base font-bold" style={{ color }}>{val}</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste repas du jour */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRepas key={i} />)}
        </div>
      ) : erreur ? (
        <ErreurChargement message={erreur} onReessayer={charger} />
      ) : (
        <div className="flex flex-col gap-3">
          {TYPES.map((t) => {
            const items = repas.filter((r) => r.type === t.value)
            if (items.length === 0) return null
            return (
              <div key={t.value}>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{t.icon} {t.label}</p>
                <div className="flex flex-col gap-2">
                  {items.map((r) => (
                    <CarteRepasJour
                      key={r.id}
                      repas={r}
                      enEdition={repasEnEdition === r.id}
                      onEditer={() => setRepasEnEdition(repasEnEdition === r.id ? null : r.id)}
                      onSauvegarder={(champs) => modifierRepas(r.id, champs)}
                      onSupprimer={() => supprimer(r.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          {repas.length === 0 && (
            <div className="flex flex-col items-center py-10 gap-3 animate-fade-up">
              <span style={{ fontSize: 48 }}>🍽️</span>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>Aucun repas ajouté</p>
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
                Ajoute ton premier repas ci-dessus
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// -------- Carte option repas (catalogue + suggestions) --------
function CarteOption({ option, ingredients, ouvert, onToggle, onChoisir, caloriesRestantes, afficherObjectif, onSupprimer }) {
  const objInfo = OBJECTIF_LABELS[option.objectif_cible]

  // Indicateur de compatibilité avec les calories restantes
  const compatible = caloriesRestantes === null || option.kcal <= caloriesRestantes
  const tropCalorique = caloriesRestantes !== null && option.kcal > caloriesRestantes

  return (
    <div className="card">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>{option.nom}</p>
              {afficherObjectif && option.objectif_cible !== 'tous' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: objInfo?.bg, color: objInfo?.color }}>
                  {objInfo?.icon} {objInfo?.label}
                </span>
              )}
              {tropCalorique && (
                <span className="text-xs" style={{ color: '#f59e0b' }}>⚠️ Dépasse l'objectif</span>
              )}
            </div>
            {option.profil && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{option.profil}</p>}
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {onSupprimer && (
              <button type="button" onClick={e => { e.stopPropagation(); onSupprimer() }}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ color: 'var(--text-faint)' }}>✕</button>
            )}
            <span style={{ color: 'var(--text-faint)' }} className="text-sm">{ouvert ? '▲' : '▼'}</span>
          </div>
        </div>
        <div className="flex gap-3 mt-2 text-xs font-medium flex-wrap">
          <span style={{ color: 'var(--orange)' }}>{option.kcal} kcal</span>
          <span style={{ color: 'var(--text-muted)' }}>P: {option.proteines_g}g</span>
          <span style={{ color: 'var(--text-muted)' }}>G: {option.glucides_g}g</span>
          <span style={{ color: 'var(--text-muted)' }}>L: {option.lipides_g}g</span>
          {option.poids_total_g && <span style={{ color: 'var(--text-faint)' }}>· {option.poids_total_g}g</span>}
        </div>
      </button>

      {ouvert && (
        <div className="mt-3 pt-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
          {ingredients.map((ing) => (
            <div key={ing.id} className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{ing.nom} {ing.quantite && `(${ing.quantite})`}</span>
              <span>{ing.kcal} kcal</span>
            </div>
          ))}
          {option.note_preparation && (
            <p className="text-xs italic mt-1 p-2 rounded-lg" style={{ color: 'var(--text-faint)', background: 'var(--surface-2)' }}>
              {option.note_preparation}
            </p>
          )}
          <button onClick={onChoisir} className="btn-primary mt-2 text-sm py-2">
            Choisir ce repas
          </button>
        </div>
      )}
    </div>
  )
}

// -------- Carte repas du jour, avec édition inline --------
function CarteRepasJour({ repas, enEdition, onEditer, onSauvegarder, onSupprimer }) {
  const estLibre = !repas.option_repas_id // pas issu du catalogue → modifiable
  const ratio = repas.quantite_g ? repas.quantite_g / 100 : 1
  const kcalAffiche = repas.options_repas
    ? Math.round((repas.options_repas.kcal || 0) * ratio)
    : (repas.kcal_libre || 0)

  const [nom, setNom] = useState(repas.nom)
  const [type, setType] = useState(repas.type)
  const [kcal, setKcal] = useState(repas.kcal_libre || '')
  const [proteines, setProteines] = useState(repas.proteines_libre || '')
  const [glucides, setGlucides] = useState(repas.glucides_libre || '')
  const [lipides, setLipides] = useState(repas.lipides_libre || '')
  const [quantite, setQuantite] = useState(repas.quantite_g || '')

  function sauvegarder(e) {
    e.preventDefault()
    onSauvegarder({
      nom,
      type,
      kcal_libre: kcal ? Number(kcal) : null,
      proteines_libre: proteines ? Number(proteines) : null,
      glucides_libre: glucides ? Number(glucides) : null,
      lipides_libre: lipides ? Number(lipides) : null,
      quantite_g: quantite ? Number(quantite) : null,
    })
  }

  const TYPES_REPAS = [
    { value: 'petit-dejeuner', label: '🌅 Petit-déj' },
    { value: 'dejeuner', label: '☀️ Déjeuner' },
    { value: 'collation', label: '🍎 Collation' },
    { value: 'diner', label: '🌙 Dîner' },
  ]

  if (enEdition) {
    return (
      <form onSubmit={sauvegarder} className="card flex flex-col gap-2.5">
        <input value={nom} onChange={(e) => setNom(e.target.value)} className="input" required />

        {/* Sélecteur de type */}
        <div className="flex gap-1.5 flex-wrap">
          {TYPES_REPAS.map(t => (
            <button key={t.value} type="button" onClick={() => setType(t.value)}
              className="text-xs px-2.5 py-1.5 rounded-full font-medium"
              style={{
                background: type === t.value ? 'var(--orange)' : 'var(--surface-2)',
                color: type === t.value ? 'white' : 'var(--text-muted)',
              }}>
              {t.label}
            </button>
          ))}
        </div>
        {estLibre && (
          <>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">Calories</label>
                <input type="number" min="0" value={kcal} onChange={(e) => setKcal(e.target.value)} className="input" />
              </div>
              <div className="flex-1">
                <label className="label">Quantité (g)</label>
                <input type="number" min="0" value={quantite} onChange={(e) => setQuantite(e.target.value)} className="input" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">Protéines</label>
                <input type="number" min="0" step="0.1" value={proteines} onChange={(e) => setProteines(e.target.value)} className="input" />
              </div>
              <div className="flex-1">
                <label className="label">Glucides</label>
                <input type="number" min="0" step="0.1" value={glucides} onChange={(e) => setGlucides(e.target.value)} className="input" />
              </div>
              <div className="flex-1">
                <label className="label">Lipides</label>
                <input type="number" min="0" step="0.1" value={lipides} onChange={(e) => setLipides(e.target.value)} className="input" />
              </div>
            </div>
          </>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onEditer}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            Annuler
          </button>
          <button type="submit" className="flex-1 btn-primary text-sm py-2">Enregistrer</button>
        </div>
      </form>
    )
  }

  return (
    <div className="card flex items-center justify-between py-3">
      <div className="flex-1">
        <span className="text-sm" style={{ color: 'var(--text)' }}>{repas.nom}</span>
        {kcalAffiche > 0 && (
          <p className="text-xs" style={{ color: 'var(--orange)' }}>
            {kcalAffiche} kcal
            {repas.quantite_g && <span style={{ color: 'var(--text-faint)' }}> · {repas.quantite_g}g</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEditer}
          className="text-xs px-2 py-1.5 rounded-lg"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          ✏️
        </button>
        <button onClick={onSupprimer} className="text-sm px-2" style={{ color: 'var(--text-faint)' }}>✕</button>
      </div>
    </div>
  )
}

// -------- Formulaire saisie libre --------
function FormulaireSaisieLibre({ nom, setNom, kcalLibre, setKcalLibre, proteinesLibre, setProteinesLibre,
  glucidesLibre, setGlucidesLibre, lipidesLibre, setLipidesLibre, quantiteG, setQuantiteG,
  onSubmit, onScanner, onAnnuler }) {

  const [suggestions, setSuggestions] = useState([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const timerRef = useRef(null)

  const ratio = quantiteG && kcalLibre ? Number(quantiteG) / 100 : 1
  const kcalCalcule = kcalLibre && quantiteG ? Math.round(Number(kcalLibre) * ratio) : null
  const proteinesCalcule = proteinesLibre && quantiteG ? Math.round(Number(proteinesLibre) * ratio * 10) / 10 : null
  const glucidesCalcule = glucidesLibre && quantiteG ? Math.round(Number(glucidesLibre) * ratio * 10) / 10 : null
  const lipidesCalcule = lipidesLibre && quantiteG ? Math.round(Number(lipidesLibre) * ratio * 10) / 10 : null
  const macrosPour100g = kcalLibre || proteinesLibre || glucidesLibre || lipidesLibre

  function onNomChange(val) {
    setNom(val)
    clearTimeout(timerRef.current)
    if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    setLoadingSearch(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/aliments?q=${encodeURIComponent(val)}`)
        const data = await res.json()
        const locaux = data.resultats || []
        setSuggestions(locaux)
        setShowSuggestions(locaux.length > 0)
      } catch {} finally {
        setLoadingSearch(false)
      }
    }, 400)
  }

  function choisirAliment(aliment) {
    setNom(aliment.nom)
    setKcalLibre(String(aliment.kcal_100g))
    setProteinesLibre(String(aliment.proteines_100g))
    setGlucidesLibre(String(aliment.glucides_100g))
    setLipidesLibre(String(aliment.lipides_100g))
    if (!quantiteG) setQuantiteG('100')
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-3 mb-6">
      <button type="button" onClick={onScanner}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium border"
        style={{ borderColor: 'var(--orange)', color: 'var(--orange)', background: 'var(--orange-light)' }}>
        📷 Scanner un code-barres
      </button>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>ou saisir manuellement</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      {/* 1. Nom avec autocomplete nutritionnel */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <input value={nom} onChange={(e) => onNomChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Ex: Poulet, Riz, Avocat..." className="input flex-1" required />
          {loadingSearch && (
            <div className="w-4 h-4 rounded-full border-2 flex-shrink-0"
              style={{ borderColor: 'var(--orange)', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
          )}
        </div>

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 rounded-xl shadow-lg overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {suggestions.map(s => (
              <button key={s.id} type="button"
                onMouseDown={() => choisirAliment(s)}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{s.nom}</p>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    P: {s.proteines_100g}g · G: {s.glucides_100g}g · L: {s.lipides_100g}g
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-sm font-bold" style={{ color: 'var(--orange)' }}>{s.kcal_100g}</p>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>kcal/100g</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Macros pour 100g */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label">{macrosPour100g ? 'Calories/100g' : 'Calories'}</label>
          <input type="number" min="0" value={kcalLibre}
            onChange={(e) => setKcalLibre(e.target.value)} placeholder="kcal" className="input" />
        </div>
        <div className="flex-1">
          <label className="label">Protéines (g)</label>
          <input type="number" min="0" step="0.1" value={proteinesLibre}
            onChange={(e) => setProteinesLibre(e.target.value)} placeholder="g" className="input" />
        </div>
        <div className="flex-1">
          <label className="label">Glucides (g)</label>
          <input type="number" min="0" step="0.1" value={glucidesLibre}
            onChange={(e) => setGlucidesLibre(e.target.value)} placeholder="g" className="input" />
        </div>
        <div className="flex-1">
          <label className="label">Lipides (g)</label>
          <input type="number" min="0" step="0.1" value={lipidesLibre}
            onChange={(e) => setLipidesLibre(e.target.value)} placeholder="g" className="input" />
        </div>
      </div>

      {/* 3. Quantité + macros recalculées */}
      {macrosPour100g && (
        <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--surface-2)' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="label">Quantité consommée (g)</label>
              <input type="number" min="0" step="1" value={quantiteG}
                onChange={(e) => setQuantiteG(e.target.value)}
                placeholder="Ex: 150" className="input" />
            </div>
            {kcalCalcule && quantiteG && (
              <div className="text-right">
                <p className="text-xl font-bold" style={{ color: 'var(--orange)' }}>{kcalCalcule}</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>kcal totales</p>
              </div>
            )}
          </div>
          {quantiteG && Number(quantiteG) !== 100 && (kcalCalcule || proteinesCalcule) && (
            <div className="flex gap-3 pt-1">
              {proteinesCalcule !== null && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>P: {proteinesCalcule}g</span>}
              {glucidesCalcule !== null && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>G: {glucidesCalcule}g</span>}
              {lipidesCalcule !== null && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>L: {lipidesCalcule}g</span>}
            </div>
          )}
        </div>
      )}

      <button type="submit" className="btn-primary w-full py-2">Ajouter</button>
      {onAnnuler && (
        <button type="button" onClick={onAnnuler}
          className="w-full py-2 rounded-xl text-sm font-medium"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          Annuler
        </button>
      )}
    </form>
  )
}
