import re
 
 
# ─────────────────────────────────────────
# 1. NETTOYAGE
# ─────────────────────────────────────────
 
def _clean(text: str) -> str:
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    text = re.sub(r'```\w*\n?', '', text)
    lines = []
    for line in text.split('\n'):
        line = re.sub(r'(?<!:)//.*$', '', line)
        lines.append(line.rstrip())
    return '\n'.join(lines)
 
 
# ─────────────────────────────────────────
# 2. CONTACT INLINE
# ─────────────────────────────────────────
 
def _parse_contact_inline(text: str) -> tuple:
    contact = {}
    parts = re.split(r'\s*[|·]\s*', text)
    titre = parts[0].strip()
    for part in parts[1:]:
        part = part.strip()
        if re.search(r'\d[\s.\-]?\d{2}[\s.\-]?\d{2}', part):
            contact['tel'] = part
        elif '@' in part:
            contact['email'] = part
        elif part:
            contact['ville'] = part
    return titre, contact
 
 
# ─────────────────────────────────────────
# 3. EXPÉRIENCES
# ─────────────────────────────────────────
 
_MOIS = (r'(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre'
         r'|Octobre|Novembre|Décembre|Jan|Fév|Mar|Avr|Jun|Jul|Sep|Oct|Nov|Déc|\d{4})')
 
def _is_date_line(line: str) -> bool:
    return bool(re.match(_MOIS, line.strip()))
 
def _parse_experiences_h3(lines: list) -> list:
    items, current = [], None
    for line in lines:
        stripped = line.strip()
        if line.startswith('### '):
            if current:
                items.append(current)
            header = line[4:].strip()
            parts = re.split(r'\s*[—–-]\s*', header, maxsplit=1)
            current = {
                'poste': parts[0].strip(),
                'entreprise': parts[1].strip() if len(parts) > 1 else '',
                'date': '',
                'bullets': []
            }
        elif current and not current['date'] and _is_date_line(stripped):
            current['date'] = stripped
        elif current and stripped.startswith('- '):
            current['bullets'].append(stripped[2:])
    if current:
        items.append(current)
    return items
 
def _parse_experiences_bold(lines: list) -> list:
    items, current = [], None
    for line in lines:
        stripped = line.strip()
        m_bold   = re.match(r'^\*\*(.+?)\*\*\s*$', stripped)
        m_italic = re.match(r'^\*(.+?)\*\s*$', stripped)
        if m_bold:
            if current:
                items.append(current)
            header = m_bold.group(1)
            parts = re.split(r'\s*[—–-]\s*', header, maxsplit=1)
            current = {
                'poste': parts[0].strip(),
                'entreprise': parts[1].strip() if len(parts) > 1 else '',
                'date': '',
                'bullets': []
            }
        elif current and m_italic and not current['date']:
            current['date'] = m_italic.group(1).strip()
        elif current and stripped.startswith('- '):
            current['bullets'].append(stripped[2:])
    if current:
        items.append(current)
    return items
 
def _detect_exp_format(lines: list) -> str:
    for line in lines:
        if line.startswith('### '):
            return 'h3'
        if re.match(r'^\s*\*\*[^*]+\*\*\s*$', line):
            return 'bold'
    return 'h3'
 
 
# ─────────────────────────────────────────
# 4. COMPÉTENCES
# ─────────────────────────────────────────
 
def _parse_competences(lines: list) -> list:
    items, current = [], None
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('### '):
            if current:
                items.append(current)
            current = {'label': stripped[4:], 'description': '', 'bullets': []}
        elif re.match(r'^-\s*\*\*(.+?)\*\*\s*:\s*(.+)$', stripped):
            if current:
                items.append(current)
            m = re.match(r'^-\s*\*\*(.+?)\*\*\s*:\s*(.+)$', stripped)
            items.append({'label': m.group(1), 'description': m.group(2), 'bullets': []})
            current = None
        elif re.match(r'^\*\*(.+?)\*\*\s*:\s*(.+)$', stripped):
            if current:
                items.append(current)
            m = re.match(r'^\*\*(.+?)\*\*\s*:\s*(.+)$', stripped)
            items.append({'label': m.group(1), 'description': m.group(2), 'bullets': []})
            current = None
        elif current and stripped.startswith('- '):
            current['bullets'].append(stripped[2:])
    if current:
        items.append(current)
    return items
 
 
# ─────────────────────────────────────────
# 5. FORMATION
# ─────────────────────────────────────────
 
def _parse_formation(lines: list) -> list:
    items, current = [], None
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('### '):
            if current:
                items.append(current)
            header = stripped[4:]
            parts = re.split(r'\s*[—–-]\s*', header, maxsplit=1)
            current = {
                'diplome': parts[0].strip(),
                'institution': parts[1].strip() if len(parts) > 1 else '',
                'date': '',
                'description': ''
            }
        elif current and not current['date'] and re.match(r'\d{4}', stripped):
            current['date'] = stripped
        elif current and stripped and not stripped.startswith(('#', '-', '*')):
            if re.match(r'\d{4}', stripped):
                current['date'] = stripped
            else:
                current['description'] = stripped
        elif re.match(r'^-\s*\*\*(.+?)\*\*', stripped):
            if current:
                items.append(current)
            m = re.match(r'^-\s*\*\*(.+?)\*\*\s*(.*)', stripped)
            header = m.group(1)
            rest = m.group(2).strip().strip('()')
            parts = re.split(r'\s*[—–,]\s*', header, maxsplit=1)
            dm = re.search(r'\d{4}[–\-]?(?:présent|\d{4})?', rest)
            current = {
                'diplome': parts[0].strip(),
                'institution': parts[1].strip() if len(parts) > 1 else '',
                'date': dm.group(0) if dm else rest,
                'description': ''
            }
            items.append(current)
            current = None
        elif not stripped.startswith(('#', '-', '*')):
            if current:
                items.append(current)
            dm = re.search(r'\(([^)]+\d{4}[^)]*)\)', stripped)
            date = dm.group(1) if dm else ''
            text = re.sub(r'\s*\([^)]+\)', '', stripped).strip()
            parts = re.split(r'\s*[—–,]\s*', text, maxsplit=1)
            current = {
                'diplome': parts[0].strip(),
                'institution': parts[1].strip() if len(parts) > 1 else '',
                'date': date,
                'description': ''
            }
            items.append(current)
            current = None
    if current:
        items.append(current)
    return [i for i in items if i.get('diplome')]
 
 
# ─────────────────────────────────────────
# 6. FONCTION PRINCIPALE
# ─────────────────────────────────────────
 
def parse_cv(markdown_text: str) -> dict:
    text  = _clean(markdown_text)
    lines = text.split('\n')
 
    result = {"nom": "", "titre": "", "contact": {}, "sections": []}
 
    # ── Nom (H1) — gère "# Nom" ET "# Nom — Titre" ET "# Nom / Titre"
    for line in lines:
        if line.startswith('# '):
            h1 = line[2:].strip()
            # Si le H1 contient un tiret long ou slash → sépare nom et titre
            m = re.match(r'^(.+?)\s*[—–/]\s*(.+)$', h1)
            if m:
                result['nom']   = m.group(1).strip()
                result['titre'] = m.group(2).strip()
            else:
                result['nom'] = h1
            break
 
    # ── Titre depuis ligne **bold** (si pas déjà extrait du H1)
    if not result['titre']:
        past_h1 = False
        for line in lines:
            if line.startswith('# '):
                past_h1 = True
                continue
            if past_h1 and line.strip():
                stripped = line.strip()
                if stripped.startswith('**'):
                    titre_raw = re.sub(r'\*\*', '', stripped).strip()
                    if '|' in titre_raw or '·' in titre_raw:
                        titre, contact = _parse_contact_inline(titre_raw)
                        result['titre']   = titre
                        result['contact'] = contact
                    else:
                        result['titre'] = titre_raw
                break
 
    # ── Sections ##
    raw_sections = []
    cur_title, cur_lines = None, []
    for line in lines:
        if line.startswith('## '):
            if cur_title is not None:
                raw_sections.append((cur_title, cur_lines))
            cur_title = line[3:].strip()
            cur_lines = []
        elif cur_title is not None:
            cur_lines.append(line)
    if cur_title is not None:
        raw_sections.append((cur_title, cur_lines))
 
    for title, sec_lines in raw_sections:
        tl = title.lower()
        if any(k in tl for k in ['profil', 'objectif']):
            result['sections'].append({
                'type': 'profil',
                'titre': title,
                'texte': '\n'.join(l for l in sec_lines if l.strip()).strip()
            })
        elif 'exp' in tl:
            fmt   = _detect_exp_format(sec_lines)
            items = (_parse_experiences_h3(sec_lines) if fmt == 'h3'
                     else _parse_experiences_bold(sec_lines))
            result['sections'].append({'type': 'experiences', 'titre': title, 'items': items})
        elif 'comp' in tl:
            result['sections'].append({
                'type': 'competences', 'titre': title,
                'items': _parse_competences(sec_lines)
            })
        elif 'form' in tl:
            result['sections'].append({
                'type': 'formation', 'titre': title,
                'items': _parse_formation(sec_lines)
            })
        else:
            result['sections'].append({
                'type': 'generic', 'titre': title,
                'texte': '\n'.join(l for l in sec_lines if l.strip()).strip()
            })
 
    return result
