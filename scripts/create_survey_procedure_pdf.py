from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase.pdfmetrics import stringWidth

OUT = "output/pdf/Wattwise_Respondent_Testing_and_Survey_Procedure.pdf"
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleWW", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=18, leading=23, alignment=TA_CENTER, textColor=colors.HexColor("#143A36"), spaceAfter=8))
styles.add(ParagraphStyle(name="SubWW", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5, leading=13, alignment=TA_CENTER, textColor=colors.HexColor("#475569"), spaceAfter=17))
styles.add(ParagraphStyle(name="H1WW", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=colors.HexColor("#143A36"), spaceBefore=12, spaceAfter=7))
styles.add(ParagraphStyle(name="H2WW", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=colors.HexColor("#1F5C54"), spaceBefore=8, spaceAfter=4))
styles.add(ParagraphStyle(name="BodyWW", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallWW", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=11.5, textColor=colors.HexColor("#334155")))
styles.add(ParagraphStyle(name="NoteWW", parent=styles["BodyText"], fontName="Helvetica-Oblique", fontSize=9, leading=13, textColor=colors.HexColor("#475569"), leftIndent=8, rightIndent=8, spaceBefore=5, spaceAfter=8))

def p(text, style="BodyWW"):
    return Paragraph(text, styles[style])

def bullets(items):
    return [Paragraph("• " + item, styles["BodyWW"]) for item in items]

def table(data, widths, header=True):
    rows = [[Paragraph(str(cell), styles["SmallWW"]) for cell in row] for row in data]
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    ts = [
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("GRID",(0,0),(-1,-1),0.35,colors.HexColor("#CBD5E1")),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
    ]
    if header:
        ts += [("BACKGROUND",(0,0),(-1,0),colors.HexColor("#143A36")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold")]
    t.setStyle(TableStyle(ts))
    return t

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.line(doc.leftMargin, 14*mm, A4[0]-doc.rightMargin, 14*mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(doc.leftMargin, 9*mm, "Wattwise • Respondent Testing and Survey Procedure")
    canvas.drawRightString(A4[0]-doc.rightMargin, 9*mm, f"Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=17*mm, bottomMargin=20*mm)
story=[]
story += [p("Respondent Testing and Survey Procedure", "TitleWW"),
          p("For the evaluation of the AI-Based Smart Appliance Energy Consumption Monitoring and Optimization System with Predictive Cost Analysis", "SubWW")]
story += [p("Purpose", "H1WW"),
          p("This procedure explains how respondents will use the Wattwise prototype before answering the end-user survey questionnaire. It ensures that ratings are based on actual interaction with the system, not only on a demonstration or assumption."),
          p("The study will use two available prototypes as two identical testing stations. Respondents will be scheduled in pairs or one at a time, depending on the venue and availability.", "NoteWW")]
story += [p("Evaluation Approach", "H1WW"),
          table([
              ["Participant group", "Method", "What they evaluate"],
              ["End users / likely household users", "Guided, task-based prototype testing followed immediately by the end-user questionnaire", "Features they can personally observe and use: dashboard, live readings, charts, cost estimate, budget setting, and alerts."],
              ["Technical experts", "Prototype demonstration, technical inspection, and expert questionnaire", "Hardware integration, telemetry, security, reliability, performance, maintainability, portability, and billing logic."],
          ], [40*mm, 63*mm, 61*mm]),
          p("End users should not be asked to rate technical claims they could not reasonably verify in one session. Items about encryption, firmware updates, long-term uptime, data-loss recovery, and technical architecture should be answered by qualified experts or supported by separate technical tests.", "NoteWW")]
story += [p("Respondent Flow", "H1WW"),
          table([
              ["Stage", "Time", "What the researcher does", "What the respondent does"],
              ["1. Welcome and consent", "5 min", "Explain the study, voluntary participation, confidentiality, and that the system—not the person—is being tested.", "Reads consent and agrees to participate."],
              ["2. Brief orientation", "3–5 min", "Show the device, test account, and safety reminders. Explain that readings, history, and alerts may use prepared test data.", "Asks initial questions."],
              ["3. Hands-on task test", "25–35 min", "Read each neutral task prompt. Observe, take notes, and avoid showing the steps unless the respondent becomes stuck.", "Completes each task independently and may describe what they are thinking."],
              ["4. Survey questionnaire", "10–15 min", "Provide the end-user questionnaire immediately after testing. Remind them to answer only items they observed or used.", "Answers privately and may select Not Observed / Unable to Assess where provided."],
              ["5. Closing", "2–3 min", "Collect the survey, invite final comments, and thank the respondent.", "Provides optional feedback."],
          ], [31*mm, 18*mm, 65*mm, 50*mm]),
          p("Estimated appointment length: 45–60 minutes per respondent. Conduct a small pilot with 2–3 people first; shorten, clarify, or remove tasks that repeatedly cause confusion or exceed the available time.", "NoteWW")]
story += [p("Standard Tasks for End-User Testing", "H1WW"),
          p("Use the same task order and wording for every respondent. Prepare a test account and safe, realistic sample data before each session. Do not tell respondents where to click unless they have already tried independently."),
          table([
              ["No.", "Neutral task prompt", "Feature being observed"],
              ["1", "“Please find the appliance currently being monitored and tell me its present electricity use.”", "Live dashboard and reading clarity"],
              ["2", "“Please check the estimated cost or bill information and explain what it means to you.”", "Cost estimate and billing breakdown"],
              ["3", "“Please set or change an electricity budget for this appliance or household.”", "Budget configuration"],
              ["4", "“Please review this budget alert and tell me what action you think you would take.”", "Alert clarity and usefulness"],
              ["5", "“Please view the previous energy-use record and describe the trend you see.”", "History, charts, and navigation"],
          ], [12*mm, 101*mm, 51*mm]),
          p("Optional task only when fully implemented: “Please add or connect a new monitoring device to the account.” Do not include this task when Wi-Fi setup, device pairing, or the related feature is incomplete.", "NoteWW")]
story += [p("Using Two Prototypes", "H1WW")]
story += bullets([
              "<b>Station A and Station B:</b> set up each prototype with the same version of the application, equivalent appliance load, stable Wi-Fi, and a separate prepared test account.",
              "<b>One respondent per station:</b> each respondent tests one complete prototype. They do not need to test both identical units.",
              "<b>Scheduling:</b> with two stations, two respondents can be tested in each 45–60 minute slot. Allow 10–15 minutes between slots to reset budgets, alerts, accounts, and observation notes.",
              "<b>Safety:</b> researchers connect and inspect electrical loads before the session. Respondents should not handle exposed wiring or alter hardware connections."
          ])
story += [p("If the two prototypes have different capabilities, do not combine their ratings as though they are the same system. Record which version each respondent used and analyze the results separately.", "NoteWW")]
story += [PageBreak(),
          p("Questionnaire Administration Rules", "H1WW"),
          table([
              ["Rule", "How to apply it"],
              ["Answer after use", "Give the end-user questionnaire only after the respondent completes the task test. A demonstration alone is insufficient for questions about ease of use, navigation, budgets, charts, or alerts."],
              ["Use one scale consistently", "Use the questionnaire’s approved Likert scale, for example: 5 = Strongly Agree, 4 = Agree, 3 = Neutral, 2 = Disagree, 1 = Strongly Disagree."],
              ["Add a non-rating option", "For end-user items outside the session, add “N/O – Not Observed / Unable to Assess.” Do not include N/O responses in the weighted-mean calculation; report their count separately."],
              ["No coaching during ratings", "Do not explain why a feature is good, tell respondents the desired answer, or stand over them while they answer. Researchers may clarify the meaning of a question without suggesting a rating."],
              ["Keep evidence", "Assign each respondent a code, record completed tasks and observed issues, and store the signed consent and survey separately from names or contact details."],
          ], [45*mm, 119*mm])]
story += [p("Items That Need Separate Evidence", "H1WW"),
          p("A 45–60 minute session can evaluate usability and perceived usefulness. The following questionnaire claims require a separate method before a rating can be treated as evidence:"),
          table([
              ["Claim type in the current questionnaire", "Appropriate evidence method"],
              ["Sensor accuracy and telemetry transmission", "Compare readings against a reference meter and review logged data."],
              ["Billing accuracy", "Compare the system calculation with a documented Meralco rate calculation and bounded usage records."],
              ["Continuous operation, outages, and data loss", "Run a monitored extended test (for example, 7–14 days) and inspect event logs and stored records."],
              ["Security, role restrictions, encryption, database policies", "Have qualified technical experts inspect the implemented controls and run appropriate security tests."],
              ["Maintainability, updates, portability to other rate structures", "Use expert review plus documented deployment, update, and configuration tests."],
          ], [67*mm, 97*mm])]
story += [p("Observation Sheet (Researcher Use)", "H1WW"),
          p("For each task, record: respondent code; prototype/station used; task completed (Yes / With Assistance / No); time taken; errors or confusion observed; and a short verbatim comment. Use these observations to explain survey results in Chapter 4 without replacing the numerical questionnaire results.")]

story += [p("Suggested Script", "H1WW"),
          p("“Thank you for participating. We are evaluating the Wattwise system, not evaluating you. There are no right or wrong answers. Please try each task as you normally would and tell us what you are thinking, if you are comfortable doing so. If you become stuck, let us know. After the tasks, you will answer a questionnaire based only on what you used or observed today.”", "NoteWW")]
story += [PageBreak(), p("How to Report This in Chapter 4", "H1WW")]
story += bullets([
              "State the number of end-user respondents, expert respondents, prototypes, dates, and the testing environment.",
              "Report task completion findings separately from questionnaire ratings.",
              "For each end-user questionnaire item, state the number of valid ratings and the number marked Not Observed / Unable to Assess.",
              "Do not claim long-term reliability, technical security, or billing accuracy based only on end-user perceptions.",
              "Use the extended technical-test findings and expert ratings to support claims that users could not verify during the session."
          ])
story += [p("Recommended Implementation Decision", "H1WW"),
          p("Use a 45–60 minute, hands-on, task-based session for each end-user respondent; then administer the end-user questionnaire immediately. Use the two prototypes as two parallel testing stations. Conduct expert assessment and extended technical testing separately for the technical quality characteristics in the questionnaire.")]

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
