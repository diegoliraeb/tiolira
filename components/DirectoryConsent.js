export default function DirectoryConsent({t,disabled=false}){
 return <fieldset className="directory-consent full" disabled={disabled}>
  <legend>{t.directoryQuestion}</legend>
  <p className="field-help">{t.directoryHelp}</p>
  <label className="check"><input type="radio" name="directoryConsent" value="yes" required/><span>{t.directoryYes}</span></label>
  <label className="check"><input type="radio" name="directoryConsent" value="no" required/><span>{t.directoryNo}</span></label>
 </fieldset>;
}
