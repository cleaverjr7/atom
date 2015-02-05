#!/bin/sh

echo "Downloading latest Atom release..."
curl -s -L "https://atom.io/download/mac" \
-H 'Accept: application/octet-stream' \
-o atom.zip

mkdir atom
unzip -q atom.zip -d atom
export PATH=$PWD/atom/Atom.app/Contents/Resources/app/apm/bin:$PATH

echo "Using Atom version:"
ATOM_PATH=./atom ./atom/Atom.app/Contents/Resources/app/atom.sh -v

echo "Installing required packages..."
atom/Atom.app/Contents/Resources/app/apm/node_modules/.bin/apm install autocomplete-plus

echo "Downloading package dependencies..."
atom/Atom.app/Contents/Resources/app/apm/node_modules/.bin/apm clean
atom/Atom.app/Contents/Resources/app/apm/node_modules/.bin/apm install

if [ -f ./node_modules/.bin/coffeelint ]; then
  if [ -f ./lib ]; then
    echo "Linting package..."
    ./node_modules/.bin/coffeelint lib
    rc=$?; if [[ $rc != 0 ]]; then exit $rc; fi
  fi
  if [ -f ./spec ]; then
    echo "Linting package specs..."
    ./node_modules/.bin/coffeelint spec
  fi
fi

echo "Running specs..."
ATOM_PATH=./atom atom/Atom.app/Contents/Resources/app/apm/node_modules/.bin/apm test --path atom/Atom.app/Contents/Resources/app/atom.sh

exit
