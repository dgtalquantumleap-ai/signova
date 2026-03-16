import os

path = r'C:\projects\signova\src\pages\Landing.jsx'
lines = open(path, 'r', encoding='utf-8').readlines()

# Lines 1-642 (indices 0-641) are good (hero + how + video + testimonials opening)
good_start = lines[:642]

# Clean testimonials section to replace the orphaned pricing mess (lines 643-789)
clean_testimonials = [
    '          <div className="testimonials-grid">\n',
    '            {TESTIMONIALS.map((t, i) => (\n',
    '              <div key={i} className="testimonial-card">\n',
    '                <p className="testimonial-text">{`"${t.text}"`}</p>\n',
    '                <div className="testimonial-author">\n',
    '                  <span className="testimonial-name">{t.name}</span>\n',
    '                  <span className="testimonial-role">{t.role}</span>\n',
    '                </div>\n',
    '              </div>\n',
    '            ))}\n',
    '          </div>\n',
    '        </div>\n',
    '      </section>\n',
    '\n',
]

# Lines 790+ (index 789+) are good (faq section onwards)
good_end = lines[789:]

result = good_start + clean_testimonials + good_end
open(path, 'w', encoding='utf-8').writelines(result)
print(f'Done. Was {len(lines)} lines, now {len(result)} lines.')
print(f'Removed {len(lines) - len(result)} lines of orphaned pricing content.')
