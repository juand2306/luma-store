content = open('apps/reports/views.py', 'r', encoding='utf-8').read()
lines = content.split('\n')

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if 'col[0].column_letter' in line and 'ws.column_dimensions' in line:
        # Replace the 3 lines: for col..., max_len..., ws.column_dimensions...
        # Find the 'for col' line above
        new_lines.pop()  # remove the max_len line already added
        new_lines.pop()  # remove the 'for col' line already added
        new_lines.append('        for col in ws.columns:')
        new_lines.append('            real_cells = [c for c in col if c.__class__.__name__ != "MergedCell"]')
        new_lines.append('            if not real_cells:')
        new_lines.append('                continue')
        new_lines.append('            max_len = max((len(str(c.value or "")) for c in real_cells), default=10)')
        new_lines.append('            ws.column_dimensions[real_cells[0].column_letter].width = min(max_len + 4, 40)')
        print(f'Replaced at line {i+1}')
    else:
        new_lines.append(line)
    i += 1

open('apps/reports/views.py', 'w', encoding='utf-8').write('\n'.join(new_lines))
print('Done, lines:', len(new_lines))
