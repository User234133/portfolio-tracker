// Remplace le bloc des 3 KPIs existants (totalDepots / totalRetraits / totalDividendes)
// par ce bloc étendu avec les soldes par compte

{/* KPIs + Soldes */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
    <p className="text-slate-400 text-xs mb-1">Total dépôts</p>
    <p className="text-xl font-bold text-blue-400">{fmt(totalDepots)}</p>
  </div>
  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
    <p className="text-slate-400 text-xs mb-1">Total retraits</p>
    <p className="text-xl font-bold text-red-400">{fmt(totalRetraits)}</p>
  </div>
  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
    <p className="text-slate-400 text-xs mb-1">Dividendes reçus</p>
    <p className="text-xl font-bold text-yellow-400">{fmt(totalDividendes)}</p>
  </div>
  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
    <p className="text-slate-400 text-xs mb-1">Cash net total</p>
    <p className={`text-xl font-bold ${(totalDepots - totalRetraits) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {fmt(totalDepots - totalRetraits)}
    </p>
  </div>
</div>

{/* Solde par compte */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
  {Object.entries(
    flux.reduce((acc: any, f: any) => {
      if (!acc[f.compte]) acc[f.compte] = { depots: 0, retraits: 0, dividendes: 0 }
      if (f.type === 'Depot') acc[f.compte].depots += f.montant
      if (f.type === 'Retrait') acc[f.compte].retraits += f.montant
      if (f.type === 'Dividende') acc[f.compte].dividendes += f.montant
      return acc
    }, {})
  ).map(([compte, totaux]: [string, any]) => {
    const solde = totaux.depots - totaux.retraits
    return (
      <div key={compte} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200">{compte}</h3>
          <span className={`text-lg font-bold ${solde >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmt(solde)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-700/50 rounded-lg p-2">
            <p className="text-slate-400 mb-0.5">Dépôts</p>
            <p className="text-blue-400 font-medium">{fmt(totaux.depots)}</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-2">
            <p className="text-slate-400 mb-0.5">Retraits</p>
            <p className="text-red-400 font-medium">{fmt(totaux.retraits)}</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-2">
            <p className="text-slate-400 mb-0.5">Dividendes</p>
            <p className="text-yellow-400 font-medium">{fmt(totaux.dividendes)}</p>
          </div>
        </div>
      </div>
    )
  })}
</div>
