// Emails distincts ayant accept_all. Total d'un destinataire = distincts, jamais la somme des cellules.
export const ALL_MEMBERS = [
  "LRM","BOU","DEC","AUC","KIA","ELD","ONY","NOR",
  "JUL","CHD","RGO","BZB","TAO","FLU","ALI","TSM","CEE","VLZ",
];

export const matrixQuery = `SELECT
  consent_member AS collector,
  recipient_member AS recipient,
  COUNT(DISTINCT email_hash) AS opt_in
FROM IDENTIFIER(:source)
WHERE event_name = 'accept_all'
GROUP BY consent_member, recipient_member`;

export const byMemberQuery = `SELECT
  recipient_member AS member,
  COUNT(DISTINCT CASE WHEN consent_member = recipient_member THEN email_hash END) AS self_opt_in,
  COUNT(DISTINCT CASE WHEN consent_member <> recipient_member THEN email_hash END) AS alliance_opt_in,
  COUNT(DISTINCT email_hash) AS total_opt_in
FROM IDENTIFIER(:source)
WHERE event_name = 'accept_all'
GROUP BY recipient_member`;
