export default function Impostazioni() {
  return (
    <div style={{background:'#000',minHeight:'100vh',fontFamily:"'Courier New',monospace",paddingBottom:'80px'}}>
      <style>{`@keyframes scanline2{0%{top:-5%}100%{top:105%}}@media(min-width:768px){.page-wrap{max-width:800px!important;padding:24px 32px 40px!important}}`}</style>
      <div style={{position:'fixed',left:0,right:0,height:'3px',background:'rgba(0,255,255,0.03)',zIndex:10,pointerEvents:'none',animation:'scanline2 24s linear infinite'}} />
      <div className="page-wrap" style={{maxWidth:'390px',margin:'0 auto',padding:'16px 14px 24px',position:'relative',zIndex:2}}>
        <div style={{borderBottom:'1px solid rgba(0,255,255,0.08)',paddingBottom:'8px',marginBottom:'20px'}}>
          <span style={{fontSize:'11px',fontWeight:700,letterSpacing:'.2em',color:'rgba(0,255,255,0.7)'}}>IMPOSTAZIONI</span>
        </div>
        <div style={{background:'#0e0e18',border:'1px solid rgba(0,255,255,0.15)',borderRadius:'2px',padding:'16px',textAlign:'center'}}>
          <span style={{fontSize:'9px',letterSpacing:'.2em',color:'rgba(0,255,255,0.62)'}}>IN_COSTRUZIONE...</span>
        </div>
      </div>
    </div>
  )
}
