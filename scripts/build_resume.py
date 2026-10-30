"""Regenerate resume.pdf with: python3 scripts/build_resume.py (requires reportlab)."""
import json
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
experience = json.loads((ROOT / 'resume/experience.json').read_text())
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='NameLine', fontName='Helvetica-Bold', fontSize=23, leading=28, alignment=TA_CENTER, textColor=colors.HexColor('#35266c')))
styles.add(ParagraphStyle(name='ContactLine', fontName='Helvetica', fontSize=9, leading=14, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='SectionLabel', fontName='Helvetica-Bold', fontSize=10, leading=14, spaceBefore=16, spaceAfter=8, textColor=colors.HexColor('#35266c')))
styles.add(ParagraphStyle(name='RoleTitle', fontName='Helvetica-Bold', fontSize=11, leading=15, spaceBefore=8, spaceAfter=3))
styles.add(ParagraphStyle(name='DetailLine', fontName='Helvetica', fontSize=9, leading=13, spaceAfter=6, textColor=colors.HexColor('#555555')))
styles.add(ParagraphStyle(name='ResumeBody', fontName='Helvetica', fontSize=9.5, leading=14, spaceAfter=7))
styles.add(ParagraphStyle(name='ResumeBullet', parent=styles['ResumeBody'], leftIndent=11, firstLineIndent=-8, spaceAfter=5))
story=[]
def text(value, style='ResumeBody'): story.append(Paragraph(value, styles[style]))
def bullets(values):
    for value in values: text('• '+value, 'ResumeBullet')
def role(client, dates):
    text(client,'RoleTitle')
    text('AlgoShack Technologies | Test Automation Engineer<br/>'+dates+' | Bengaluru, India','DetailLine')
text('MUZAMMIL PATEL','NameLine')
text('Test Automation Engineer','ContactLine')
text('Bengaluru, India | +91 7204947143 | muzammilp1162@gmail.com','ContactLine')
text('muzammilpatel.com | GitHub: Muzammil-patel019 | LinkedIn: Muzammil Patel','ContactLine')
text('PROFILE SUMMARY','SectionLabel')
text('Test Automation Engineer experienced in manual and automated testing of healthcare desktop and web applications for Philips and GE Healthcare. Builds reusable automation with C#, Python, Java, FlaUI, Selenium, and TestComplete. Focuses on BDD, end-to-end validation, parameterized execution, regression testing, and failure investigation, with hands-on testing on CT physical machines.')
text('TECHNICAL SKILLS','SectionLabel')
rows=[('Languages','C#, Python, Java, SQL'),('Automation','FlaUI, Selenium WebDriver, TestComplete'),('Frameworks & approaches','NUnit, SpecFlow, Cucumber, BDD/Gherkin, Page Object Model, parameterized testing'),('Testing','Manual, desktop, web, end-to-end, functional, regression, sanity, smoke, integration, UI, boundary, negative, defect verification'),('Delivery & version control','Git, GitHub, GitLab, Git Bash, GitHub Actions, Azure DevOps pipelines'),('API & methodologies','Postman; Agile, regression and release validation')]
table=Table([[Paragraph(a,styles['DetailLine']),Paragraph(b,styles['ResumeBody'])] for a,b in rows],colWidths=[130,365])
table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),5),('LEFTPADDING',(0,0),(-1,-1),0)]))
story.append(table)
text('PROFESSIONAL EXPERIENCE','SectionLabel')
text('AlgoShack Technologies | April 2024 – Present','DetailLine')
role('Philips — IGT Azurion','September 2025 – Present')
bullets([
'Developed and maintained C#, FlaUI, NUnit, and SpecFlow automation components for WPF healthcare applications, including tree navigation and UI synchronization.',
'Implemented expected-versus-actual PSC procedure validation, reporting missing and unexpected procedures across system configurations.',
'Created reusable helpers for scrolling, screenshots, OCR-based UI checks, and XML/JSON processing; supported multiple Azurion variants through configuration-driven validation.',
'Investigated automation failures using logging and exception handling; executed smoke, regression, integration, and release validation tests with Azure DevOps pipeline integration.'
])
story.append(PageBreak())
text('PROFESSIONAL EXPERIENCE — CONTINUED','SectionLabel')
role('GE Healthcare — Elever','April 2025 – September 2025')
bullets(experience['ge'])
role('Philips — CT-Incisive','April 2024 – March 2025')
bullets(experience['ct'])
text('EDUCATION','SectionLabel')
text('<b>Bachelor of Engineering — Computer Science Engineering</b><br/>Visvesvaraya Technological University | August 2019 – August 2023 | CGPA: 8.0')
def footer(canvas, doc):
    canvas.setFont('Helvetica',8)
    canvas.setFillColor(colors.HexColor('#777777'))
    canvas.drawString(50,27,'Muzammil Patel | Test Automation Engineer')
    canvas.drawRightString(A4[0]-50,27,str(doc.page))
SimpleDocTemplate(str(ROOT/'resume.pdf'), pagesize=A4, rightMargin=50,leftMargin=50,topMargin=38,bottomMargin=43,title='Muzammil Patel — Resume',author='Muzammil Patel').build(story,onFirstPage=footer,onLaterPages=footer)
