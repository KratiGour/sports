f = open(r'c:\Users\khari\Documents\GitHub\sports\frontend\src\pages\LandingPage.tsx', 'rb')
c = f.read()
f.close()

# Fix 1: problem.icon -> const Icon = problem.icon; <Icon />
c = c.replace(
    b'              <div className="flex items-start gap-4">\r\n                  <div className="w-16 h-16 bg-[image:var(--primary-gradient)] rounded-full flex items-center justify-center flex-shrink-0">\r\n                    <problem.icon className="w-8 h-8 text-white" />',
    b'              <div className="flex items-start gap-4">\r\n                  <div className="w-16 h-16 bg-[image:var(--primary-gradient)] rounded-full flex items-center justify-center flex-shrink-0">\r\n                    {(() => { const Icon = problem.icon; return <Icon className="w-8 h-8 text-white" />; })()}'
)

# Fix 2: feature.icon -> const Icon = feature.icon; <Icon />
c = c.replace(
    b'                  <feature.icon className="w-10 h-10 text-white" />',
    b'                  {(() => { const Icon = feature.icon; return <Icon className="w-10 h-10 text-white" />; })()}'
)

# Fix 3: item.icon in Why Choose Us (w-7 h-7)
c = c.replace(
    b'                  <item.icon className="w-7 h-7 text-white" />',
    b'                  {(() => { const Icon = item.icon; return <Icon className="w-7 h-7 text-white" />; })()}'
)

# Fix 4: item.icon in How It Works (w-10 h-10)
c = c.replace(
    b'                   <item.icon className="w-10 h-10 text-white" />',
    b'                   {(() => { const Icon = item.icon; return <Icon className="w-10 h-10 text-white" />; })()}'
)

# Fix 5: item.icon in Trust Indicators (w-6 h-6)
c = c.replace(
    b'                  <item.icon className="w-6 h-6 text-white" />',
    b'                  {(() => { const Icon = item.icon; return <Icon className="w-6 h-6 text-white" />; })()}'
)

f = open(r'c:\Users\khari\Documents\GitHub\sports\frontend\src\pages\LandingPage.tsx', 'wb')
f.write(c)
f.close()
print('Done')
