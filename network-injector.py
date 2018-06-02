import glob, os, json, sys

if sys.argv[1] == 'export':
    for file in glob.glob('./build/contracts-stage/*'):
        os.remove(file)
    os.rmdir('./build/contracts-stage/')
    os.mkdir('./build/contracts-stage/')
    files = glob.glob('build/contracts/*.json')
    for file in files:
        stage_file = file.replace('contracts/', 'contracts-stage/')
        if os.path.isdir(file):
            continue

        with open(file, 'r') as f, open(stage_file, 'w') as wf:
            data = json.loads(f.read())
            network_info = data['networks']
            wf.write(json.dumps({'networks': network_info}, indent=2))

if sys.argv[1] == 'import':
    files = glob.glob('build/contracts/*.json')
    for file in files:
        stage_file = file.replace('contracts/', 'contracts-stage/')
        if not os.path.exists(stage_file) or os.path.isdir(file):
            continue

        with open(stage_file, 'r') as rf, open(file, 'r') as f:
            data = json.loads(f.read())
            network_info = json.loads(rf.read())['networks']
            data.update({'networks': network_info})

        with open(file, 'w') as wf:
            wf.seek(0)
            wf.write(json.dumps(data, indent=2))
